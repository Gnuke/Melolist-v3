# API Contract: 웹검색 심층 곡 탐색 (더 깊이 찾기)

**Date**: 2026-08-04 | **Feature**: [spec.md](../spec.md)

> **동기화 의무 (constitution 원칙 II)**: 이 계약은 구현 PR에서
> `docs/prd/backend-prd.md` §6.1과 `docs/prd/frontend-prd.md` §8에 **동일 내용으로
> 반영**되어야 한다(같은 PR).

공통: 표준 에러 바디 `{code, message, details}` · 세 엔드포인트 모두 **인증 필수**
(무JWT 401 — SecurityConfig `/api/search/deep/**` authenticated, 와일드카드 permitAll보다
앞에 등록). `X-Session-Id` 헤더 필수(계측 상관관계용 — 쿼터 키는 JWT sub).

## 1. GET /api/search/deep/quota — 잔여 횟수 조회 (확인 단계 UI 원천)

200:

```jsonc
{
  "limit": 2,
  "used": 1,
  "remaining": 1,
  "reset_at": "2026-08-05T00:00:00+09:00"   // Asia/Seoul 자정
}
```

## 2. POST /api/search/deep — 심층 탐색 실행

요청 (기존 text 검색과 동일 규칙 — 트림 후 2~200자):

```jsonc
{ "query": "올해 나온 노래인데 후렴이 '...'로 반복돼요" }
```

200 — 후보 있음 (0~5곡, 순서=신뢰도순. 항목은 기존 TrackResult + `verified`):

```jsonc
{
  "results": [
    {
      "acrid": "ai-3f9a1c2b8d4e7f01",     // ai-key — 일반 폴백과 동일 체계(select·♡에 사용)
      "title": "새로 나온 그 곡",
      "artists": [{ "name": "신인가수" }],
      "album": null,
      "release_date": null,                // 항상 null (002 규칙 유지)
      "score": null,                       // 항상 null
      "verified": false,                   // ★ 신규 — false = "미확인" 배지 표시
      "youtube_video_id": "abc123XYZ_w",   // verified=true: 카탈로그 값 / false: 웹 근거 값(검증 통과분, null 가능)
      "youtube_url": "https://www.youtube.com/watch?v=abc123XYZ_w",
      "cover_url": "https://i.ytimg.com/vi/abc123XYZ_w/mqdefault.jpg"  // false면 ytimg 파생 또는 null
    }
  ]
}
```

- `verified` 필드는 **심층 탐색 응답에만** 존재한다. 기존 fingerprint/humming/text
  응답은 NON_NULL 직렬화로 무변화(프론트는 `verified === false`일 때만 배지 표시).

200 — 무후보: `{"results": []}` (오류 아님 — 단서 보완 안내)

에러:

```jsonc
// 400 — 길이 위반 (기존 규약 재사용)
{ "code": "VALIDATION_ERROR", "message": "입력값이 올바르지 않습니다.",
  "details": { "query": "검색 설명은 2~200자여야 합니다." } }

// 401 — 게스트 (프론트는 진입점에서 선차단하므로 방어선)
// 429 — 일일 한도 초과 (사용자당 2회/일, Asia/Seoul 자정 리셋 — 코드는 002와 공유)
{ "code": "AI_QUOTA_EXCEEDED", "message": "오늘의 심층 탐색 횟수를 모두 사용했어요.",
  "details": { "limit": "2", "reset_at": "2026-08-05T00:00:00+09:00" } }

// 502 — 웹검색 업스트림 실패·서버 22s 컷 (F4 패턴 + 재시도)
{ "code": "EXTERNAL_API_ERROR", "message": "심층 탐색이 잠시 원활하지 않아요.", "details": null }
```

타임아웃 예산: 서버 웹호출 22s + 메타 8s ≈ 최악 30s / **클라 axios 35s**(초과 시
ECONNABORTED → error 상태). SC-003은 p95 ≤ 30s.

## 3. POST /api/search/deep/select — 후보 선택 확정 (저장 시점)

요청 — 선택한 후보 항목 그대로(`verified` 포함) + rank:

```jsonc
{
  "candidate": { /* 위 200 응답의 results[i] 항목 그대로 */ },
  "rank": 1
}
```

서버 동작: ai-key 재계산·`candidate.acrid` 일치 검증(불일치 400) → `music` upsert
(acrid=ai-key, **source="WEB"**, youtube_video_id=candidate 값) → `search_history`
(**Type.DEEP**/MATCHED) 기록 → `deep_search_select` 이벤트. 이후 즐겨찾기·플레이리스트
담기는 acrid=ai-key로 **기존 계약 무변경**.

200 — 기존 `MusicResponse` 형태 (002 contracts §2와 동일).

## 4. 이벤트 사전 추가분 (backend-prd §6.1 이벤트 표에 병합)

| type | 기록 주체 | properties | 비고 |
|------|-----------|------------|------|
| `deep_search_open` | 클라 | `{from: "ai_empty"\|"ai_mismatch"}` | 진입점 탭 시(확인 단계 진입) |
| `deep_search_request` | 서버 | `{query_len, web_ms, meta_ms, total_ms, candidates, unverified, outcome: "hit"\|"empty"\|"error"\|"quota"}` | **쿼터 원장 겸임**. outcome=quota는 카운트 제외 |
| `deep_search_select` | 서버 | `{rank, ai_key, resolved, verified}` | resolved=videoId 존재, verified=카탈로그 확인 여부 |
| `deep_search_cancel` | 클라 | `{elapsed_ms}` | AbortController 취소 시 |

SC 산출 (kr_metrics.sql에 절 추가):

- SC-001 시도율 = `deep_search_open` 세션 수 ÷ `ai_search_request(outcome=empty)` 또는
  후보 미채택(ai_search_request(hit) − ai_search_select) 세션 수
- SC-002 채택률 = `deep_search_select` 수 ÷ `deep_search_request(outcome∈{hit,empty})` 수
- SC-003 p95 = `deep_search_request.total_ms` percentile
- SC-004 한도 초과 실행 0건 = 사용자·일자별 `deep_search_request(outcome≠quota)` 카운트
  최댓값 ≤ limit 검증 쿼리
- SC-005 미확인 비중 = `sum(unverified) ÷ sum(candidates)`

## 5. 프론트 타입 변경 (frontend-prd §8에 반영)

- `AcrResult`: `verified?: boolean` 추가 — `false`일 때만 "미확인" 배지 표시(undefined=
  기존 검색, 배지 없음).
- 라우트 무변경 — 심층 탐색은 폴백 Phase 내부 단계(DeepSearchFlow). API 함수
  `deepQuota()` / `deepSearch(query, signal)`(타임아웃 35s) / `selectDeepCandidate(candidate, rank)` 추가.
- 오류 message 직접 렌더 금지(F4) 규칙 동일 적용. 429 응답의 `details.reset_at`으로
  리셋 시각 표시(기존 quota 화면 패턴 재사용).
