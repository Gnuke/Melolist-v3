# Data Model: AI 자연어 폴백 검색

**Date**: 2026-07-21 | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

**핵심**: 신규 테이블 0, 스키마 마이그레이션 0. 기존 `music`·`search_history`·
`event_log`를 재사용하고, 비영속 DTO(후보)와 이벤트 스키마만 새로 정의한다.

## 1. 기존 엔티티 재사용·변경점

### music (변경: 값 규칙만, 스키마 무변경)

| 컬럼 | AI 폴백에서의 값 | 비고 |
|------|------------------|------|
| `id` | IDENTITY (기존) | PK |
| `acrid` | **`ai-<hash16>` 결정적 키** | nullable unique(64) 재사용. 의미가 "ACR id" → "외부 식별 키"로 확장 |
| `title` / `artist` / `album` | LLM 후보 값 (artist는 ", " 연결 저장 — 기존 규칙) | |
| `release_date` | null 허용 (기존) | LLM 값은 신뢰도 낮아 저장하지 않음 |
| `youtube_video_id` / `cover_url` | `AcrMetadataClient` 해석 값, 실패 시 null | 기존 정본 규칙(C1) 그대로 |
| `source` | **`"AI"`** | 기존 컬럼(기본값 ACRCLOUD), NOT NULL len 20 |

**ai-key 생성 규칙** (백엔드 단일 구현, select 시 서버가 재계산·검증):

```
normalize(s) = trim(s) → lowercase → 연속 공백 1개로 축약
key = "ai-" + hex(sha256(normalize(title) + "|" + normalize(artist)))[0:16]
```

**upsert 경로 변경**: `MusicUpsertCommand`에 `source` 필드 추가(기존 호출부는
`"ACRCLOUD"` 유지). acrid=ai-key로 `findByAcrid` → 있으면 `fillMissing`, 없으면
insert — 기존 dedup·동시성 수렴 로직 그대로 동작.

**알려진 한계(수용)**: 같은 곡이 ACR 검색(실제 acrid)과 AI 선택(ai-key)으로 각각
저장되면 2개 row가 생긴다. 베타 규모에서 실해 없음 — 후속에 title/artist 병합 검토.

### search_history (변경 없음 — 기존 enum 재사용)

- `Type.TEXT` (기존재) — AI 폴백으로 **선택 확정된** 곡만 기록. `Status.MATCHED` 고정
  (무후보·미선택은 기록하지 않음 — FR-006, 판정은 event_log가 담당).
- 로그인 사용자만 기록(기존 정책). select 요청에 JWT 없으면 skip.

### event_log (변경 없음 — 이벤트 타입 추가만)

신규 이벤트 4종 (계약 상세·기록 주체는 [contracts/search-text-api.md](./contracts/search-text-api.md) §3):

| type | 주체 | 핵심 properties |
|------|------|-----------------|
| `ai_fallback_open` | 클라 | `from`: `no_match` \| `mismatch` |
| `ai_search_request` | 서버 | `query_len, ai_ms, meta_ms, total_ms, candidates, outcome(hit\|empty\|error\|quota)` |
| `ai_search_select` | 서버 | `rank(1~5), ai_key, resolved(videoId 유무)` |
| `ai_search_cancel` | 클라 | `elapsed_ms` |

**quota 판정 원천**: `ai_search_request`를 (로그인) `user_id` 또는 (게스트)
`session_id` 기준으로 Asia/Seoul 당일 카운트. `EventLogRepository`에 카운트 쿼리
1개 추가. outcome=quota인 요청도 기록하되 **카운트에서는 제외**(한도 소진으로
치지 않음 — 429 반복이 기록을 밀어내지 않도록).

## 2. 비영속 모델 (DTO)

### AiCandidate (후보 — 응답 전용, 저장 안 함)

기존 검색 응답 항목(`AcrResult`)과 동일 형태 (R10):

| 필드 | 타입 | 값 |
|------|------|----|
| `acrid` | string | `ai-<hash16>` (선택·즐겨찾기 시 키로 사용) |
| `title` | string | LLM 후보 |
| `artists` | **string[]** | LLM 후보 — 반드시 배열(07-16 버그 재발 방지 규칙) |
| `album` | string \| null | LLM 후보 |
| `release_date` | null | 항상 null |
| `score` | null | 항상 null (매칭률 없음 — 프론트 배지 미표시 근거) |
| `youtube_video_id` | string \| null | 메타 해석 값 |
| `youtube_url` | string \| null | videoId에서 파생(기존 규칙) |
| `cover_url` | string \| null | 메타 해석 값(핫링크) |

### TextSearchRequest / TextSelectRequest

- `TextSearchRequest`: `{ query: string }` — 트림 후 2~200자 (Bean Validation)
- `TextSelectRequest`: 선택한 `AiCandidate` 전체 + `{ rank: number }` — 서버는
  title/artists로 ai-key를 재계산해 acrid 필드와 일치 검증(위조 방지)

## 3. 상태 흐름

```
[허밍/지문 검색 실패·오매칭]
   → (클라) ai_fallback_open
   → POST /api/search/text ──(quota 검사)──► 429 quota
   →   LLM 후보 식별(10s 컷) ──error──► 502 → F4 재시도
   →   후보별 메타 해석 병렬(4s 컷, 실패 시 링크 null)
   →   200 {results: AiCandidate[0..5]}   ← 저장 없음
   → (사용자 후보 선택)
   → POST /api/search/text/select
   →   music upsert (acrid=ai-key, source=AI)   ← 유일한 영속 시점
   →   search_history 기록 (JWT 있을 때만, Type.TEXT/MATCHED)
   →   ai_search_select 기록
   → 이후 즐겨찾기·플레이리스트 담기: 기존 흐름 그대로 (acrid=ai-key로 동작)
```

취소(AbortController): 클라가 `ai_search_cancel` 기록, 서버 응답은 폐기.
quota 카운트는 요청 접수 시점 기준이므로 취소해도 소모된다(R7).
