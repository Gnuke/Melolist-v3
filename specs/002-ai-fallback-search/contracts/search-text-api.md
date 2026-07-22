# API Contract: AI 자연어 폴백 검색

**Date**: 2026-07-21 | **Feature**: [spec.md](../spec.md)

> **동기화 의무 (constitution 원칙 II)**: 이 계약은 구현 PR에서
> `docs/backend-prd.md` §6.1과 `docs/frontend-prd.md` §8에 **동일 내용으로 반영**되어야
> 한다(같은 PR). §6.2 로드맵 표의 `POST /search/text` 행(M5·recommendation 예정)은
> 본 기능(search 도메인)으로 이관 확정.

공통: 표준 에러 바디 `{code, message, details}` · `X-Session-Id` 헤더 필수(게스트
quota 키) · JWT 옵션(있으면 계정 기준 quota·기록). 두 엔드포인트 모두 permitAll
(`/api/search/text`는 SecurityConfig에 기등록, `/text/select` 추가 필요).

## 1. POST /api/search/text — 후보 검색

요청:

```jsonc
// Content-Type: application/json
{
  "query": "여자 보컬 드라마 OST, 가사에 '바람'이 들어감"  // 트림 후 2~200자
}
```

200 — 후보 있음 (0~5곡, 항목은 기존 검색 결과와 동일 형태·순서=신뢰도순):

```jsonc
{
  "results": [
    {
      "acrid": "ai-3f9a1c2b8d4e7f01",     // ai-<hash16> 결정적 키 (select·즐겨찾기에 사용)
      "title": "바람이 불어오는 곳",
      "artists": [{ "name": "김광석" }],   // 기존 계약과 동일 — 객체 배열 (07-16 배열 규칙 준수)
      "album": { "name": "네 번째" },      // null 가능
      "release_date": null,                // AI 후보는 항상 null
      "score": null,                       // AI 후보는 항상 null (일치율 배지 미표시)
      "youtube_video_id": "abc123XYZ_w",   // 메타 해석 실패 시 null
      "youtube_url": "https://www.youtube.com/watch?v=abc123XYZ_w",  // videoId 파생, null 가능
      "cover_url": "https://..."           // 핫링크, null 가능
    }
  ]
}
```

200 — 무후보: `{"results": []}` (오류 아님 — 프론트는 단서 보완 안내 표시, US3)

에러:

```jsonc
// 400 — 길이 위반 (기존 Bean Validation 규약 재사용 — 구현 확정 2026-07-21)
{ "code": "VALIDATION_ERROR", "message": "입력값이 올바르지 않습니다.",
  "details": { "query": "검색 설명은 2~200자여야 합니다." } }

// 429 — 일일 한도 초과 (게스트 3회 / 로그인 10회, Asia/Seoul 자정 리셋)
{ "code": "AI_QUOTA_EXCEEDED", "message": "오늘의 AI 검색 횟수를 모두 사용했어요.",
  "details": { "limit": "3", "reset_at": "2026-07-22T00:00:00+09:00" } }

// 502 — AI 업스트림 실패·10s 타임아웃 (기존 외부 API 오류 규약 재사용 — 프론트: F4 패턴 + 재시도)
{ "code": "EXTERNAL_API_ERROR", "message": "AI 검색이 잠시 원활하지 않아요.", "details": null }
```

## 2. POST /api/search/text/select — 후보 선택 확정 (유일한 저장 시점)

요청 — 선택한 후보 항목 그대로 + rank:

```jsonc
{
  "candidate": { /* 위 200 응답의 results[i] 항목 그대로 */ },
  "rank": 1        // 후보 목록에서의 순위 1~5 (계측용)
}
```

서버 동작: title/artists로 ai-key 재계산 → `candidate.acrid` 일치 검증(불일치 400
`BAD_REQUEST` — 기존 규약 재사용) → `music` upsert(acrid=ai-key, source=AI) → JWT 있으면
`search_history`(TEXT/MATCHED) 기록 → `ai_search_select` 이벤트 기록.

200 — 기존 `MusicResponse` 형태(id = music PK):

```jsonc
{
  "id": 123,
  "title": "바람이 불어오는 곳",
  "artist": "김광석",                 // MusicResponse 규칙: ", " 연결 문자열
  "album": "네 번째",
  "release_date": null,
  "youtube_video_id": "abc123XYZ_w",
  "youtube_url": "https://www.youtube.com/watch?v=abc123XYZ_w",
  "cover_url": "https://...",
  "duration_ms": null
}
```

이후 즐겨찾기(`POST /favorites`, acrid=ai-key)·플레이리스트 담기는 **기존 계약
무변경**으로 동작한다.

## 3. 이벤트 사전 추가분 (backend-prd §6.1 이벤트 표에 병합)

| type | 기록 주체 | properties | 비고 |
|------|-----------|------------|------|
| `ai_fallback_open` | 클라 | `{from: "no_match"\|"mismatch"}` | 폴백 진입점 노출→탭 시 |
| `ai_search_request` | 서버 | `{query_len, ai_ms, meta_ms, total_ms, candidates, outcome: "hit"\|"empty"\|"error"\|"quota"}` | quota 판정 원천. outcome=quota는 카운트 제외 |
| `ai_search_select` | 서버 | `{rank, ai_key, resolved: boolean}` | resolved = videoId 해석 성공 여부 |
| `ai_search_cancel` | 클라 | `{elapsed_ms}` | AbortController 취소 시 |

SC 산출 예 (KR SQL 파일에 추가 예정):
- SC-001 폴백 시도율 = `ai_fallback_open(from=no_match)` 세션 수 ÷ `search_failed(no_match)` 세션 수
- SC-002 채택률 = `ai_search_select` 수 ÷ `ai_search_request(outcome∈{hit,empty})` 수
- SC-003 p95 = `ai_search_request.total_ms` percentile
- SC-004 전환율 = 미매칭 세션 중 `ai_search_select` 발생 세션 비율

## 4. 프론트 타입 변경 (frontend-prd §8에 반영)

- `AcrResult`: `score`·`release_date`를 `number | null`·`string | null`로 완화
  (AI 후보 수용). score=null이면 일치율 배지 미표시.
- `SearchType`에 화면 상태로서의 `text`는 추가하지 않음 — 폴백은 `/search/:mode`
  내부 Phase로 처리(라우트 무변경). API 함수만 `textSearch(query, signal)` /
  `selectCandidate(candidate, rank)` 추가.
- 오류 message 직접 렌더 금지(F4) 규칙은 AI 오류(502)에도 동일 적용.
