# Data Model: 웹검색 심층 곡 탐색

**Date**: 2026-08-04 | **Feature**: [spec.md](./spec.md) | **신규 테이블 없음**

## 1. WebSongCandidate (백엔드 record — 비영속)

웹검색이 식별한 곡 후보. `AiSongCandidate`(spec 002)의 확장형 — 웹 근거 링크가 추가된다.

| 필드 | 타입 | 규칙 |
|------|------|------|
| title | String | 공식 곡명(원표기). null/blank 후보는 폐기 |
| artists | List\<String\> | 아티스트 배열 |
| album | String | 모르면 null |
| titleAlt / artistAlt | String | 공식 영문(로마자) 표기 — 3단 메타 대조용(002와 동일) |
| youtubeVideoId | String | **웹 근거 링크**. LLM이 준 URL/ID에서 서버가 추출·검증(11자 패턴, §5.2 규칙 — R5). 불일치 시 null |

## 2. 심층 탐색 응답 항목 — SearchResponse.TrackResult + verified

기존 `SearchResponse.TrackResult`에 `verified`(Boolean) 필드 추가.

- **심층 탐색 응답**: 전 항목에 true/false 명시.
  - `verified=true`: 카탈로그 대조 성공 — videoId·커버는 **카탈로그 값이 정본**(웹 링크 무시).
  - `verified=false`: 미확인 — videoId는 웹 근거 값(null 가능), 커버는 ytimg 파생 또는 null.
- **기존 경로**(fingerprint/humming/text): 필드 미설정(null) → **NON_NULL 직렬화로 응답
  무변화** (기존 계약·프론트 호환 보장이 수용 기준).
- acrid = `ai-<hash16>`(AiKeyGenerator, 002와 동일 체계) — 일반 폴백/심층 채택이 같은
  music 행에 수렴(R8). score·release_date는 항상 null(002 규칙 유지).

## 3. 영속 데이터 변경 (값 추가만 — 마이그레이션 불필요)

| 테이블 | 변경 | 비고 |
|--------|------|------|
| `search_history` | `Type` enum에 `DEEP` 추가 | varchar(20) STRING 매핑 — DDL 무변경. FR-007(기록 구분) 충족 |
| `music` | `source` 값 `"WEB"` 사용 | 기존 자유 문자열 컬럼(ACR/AI에 이어 3번째 값). 심층 채택 곡 식별용 |
| `event_log` | `deep_search_*` 4종 적재 | 스키마 무변경(jsonb properties). `deep_search_request`가 쿼터 원장 겸임 |

미확인 곡의 music 행: `youtube_video_id`=웹 근거 값(null 가능), `cover_url`=**선택한
후보 카드 값 그대로**(ytimg 파생 URL 포함 가능 — 002 select 동작과 동일, contracts §3이
정본). 링크 전무 시 기존 "재생 링크 미해석 곡" 형태와 동일. 향후 같은 곡이 ACR로 인식되면 acrid 다른 별도 행이 생기는 중복 가능성은
**002의 기존 트레이드오프 그대로**(본 기능이 새로 만들지 않음 — 백로그 유지).

## 4. 심층 탐색 이용 한도 (파생 값 — 저장 없음)

- 원장: `event_log`에서 `type='deep_search_request' and user_id=? and created_at>=오늘
  자정(Asia/Seoul) and outcome≠'quota'` 카운트 (기존 `countByTypeAndUserSince` 재사용).
- 한도: `melolist.ai.deep.user-daily`(기본 2). 로그인 전용이라 세션 키 없음.
- 잔여 조회: `GET /api/search/deep/quota` → `{limit, used, remaining, reset_at}` —
  확인 단계 UI 원천(FR-002).

## 5. 상태 전이 (프론트 DeepSearchFlow)

```text
(AI 폴백 empty | candidates)
   └─ 진입점 탭 ─ 게스트? ─ yes → 로그인 유도(복귀 스태시) ─ 로그인 후 복귀
                     └ no ↓
   confirm (질의 프리필·수정 가능, 잔여 횟수·소요 안내)
   ├─ 잔여 0 → quota (소진 안내·리셋 시각)
   └─ 실행 확정 → searching (진행 표시, 취소 가능)
        ├─ 후보 ≥1 → candidates (verified/미확인 배지 혼재)
        │     ├─ 선택 → select(저장·기록·계측) → 선택됨 표시 → ♡/담기 가능
        │     └─ "이전 결과로" → 원래 AI 폴백 화면 복귀 (US2)
        ├─ 후보 0  → empty (단서 보완 안내 → confirm 복귀)
        ├─ 오류/타임아웃(35s) → error (재시도 → confirm)
        ├─ 429 → quota
        └─ 취소 → 진입 전 화면 복귀 (deep_search_cancel, 한도는 접수 시점 집계 유지)
```
