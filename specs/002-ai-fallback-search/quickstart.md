# Quickstart: AI 자연어 폴백 검색 — 검증 가이드

**Date**: 2026-07-21 | **Contracts**: [contracts/search-text-api.md](./contracts/search-text-api.md)

구현 완료 후 기능이 end-to-end로 동작함을 증명하는 실행 시나리오. constitution
원칙 VI에 따라 **1~5는 외부 실호출 없이**(mock) 검증하고, 6에서만 실키를 쓴다.

## 사전 준비

```powershell
# backend — mock 이중 활성화(ACR 메타 + AI 둘 다 목업)
$env:SPRING_PROFILES_ACTIVE = "acr-mock,ai-mock"
$env:AI_MOCK_SCENARIO = "hit"          # hit | empty | error | slow
cd backend; .\gradlew bootRun
```

프론트: `cd frontend; npm run dev` (dev mock 시나리오는 `searchMock.ts` 참조).

## 1. 후보 검색 성공 (hit)

```powershell
curl.exe -s -X POST http://localhost:8080/api/search/text `
  -H "Content-Type: application/json" -H "X-Session-Id: 11111111-1111-1111-1111-111111111111" `
  -d '{\"query\": \"여자 보컬 드라마 OST 바람\"}'
```

기대: 200, `results` 1~5곡, 각 항목에 `acrid`가 `ai-` 접두 16 hex, `artists`가
**배열**, `score`/`release_date`가 null. videoId·cover는 acr-mock 목업 값.

## 2. 무후보 (empty) → 재시도 UX

`AI_MOCK_SCENARIO=empty` 재기동 → 같은 요청 → 기대: 200 `{"results":[]}`.
프론트: 오류 화면이 아닌 "단서 보완 안내 + 입력 유지 재시도"(US3) 확인.

## 3. 업스트림 오류·타임아웃 (error / slow)

- `error`: 기대 502 `{code:"AI_UPSTREAM_ERROR"}` → 프론트 F4 패턴 + 재시도 버튼.
- `slow`(12s 지연): 백엔드 10s 컷으로 502 도달 확인. 프론트에서 진행 표시 중
  취소 버튼 동작(요청 abort, 이전 화면 복귀) 확인.

## 4. 선택 확정 → 저장·기록·후속 흐름

1. 시나리오 hit에서 후보 1개를 `POST /api/search/text/select`로 확정(rank=1).
   기대: 200 + `music_id`. **같은 후보 재선택 시 동일 `music_id`**(ai-key dedup).
2. DB 확인: `music`에 `source='AI'`, `acrid='ai-…'` row 1개만 존재.
   `candidate.acrid`를 위조해 보내면 400 `BAD_REQUEST`(기존 규약).
3. 로그인 JWT로 select → `search_history`에 `type=TEXT, status=MATCHED` 1건.
   게스트(JWT 없음) select → history 미기록, upsert는 수행.
4. 선택된 곡에서 즐겨찾기(acrid=ai-key) → 기존 `POST /favorites` 무변경 동작 확인.
5. **US2**: 프론트에서 매칭 결과 화면(hit)의 "찾는 곡이 아닌가요? 말로 설명해서 찾기" →
   폴백 진입 → 상단 [뒤로]로 원래 매칭 결과가 복원되는지 확인(재계측 없음).

## 5. 일일 한도 (429)

같은 `X-Session-Id`로 4번째 요청(게스트 한도 3) → 기대 429
`{code:"AI_QUOTA_EXCEEDED", details:{limit:3, reset_at:...}}`. 프론트: 한도 안내 +
리셋 시점 표시. 확인 SQL(quota 원천 = event_log):

```sql
select count(*) from event_log
where type = 'ai_search_request'
  and properties->>'outcome' <> 'quota'
  and session_id = '11111111-1111-1111-1111-111111111111'
  and created_at >= (now() at time zone 'Asia/Seoul')::date::timestamp at time zone 'Asia/Seoul';
```

## 6. 실키 스모크 (배포 전 1회, 수동)

```powershell
$env:SPRING_PROFILES_ACTIVE = ""        # 실구현 (acr-mock/ai-mock 해제)
$env:OPENAI_API_KEY = "<실키>"          # backend/.env — 커밋 금지 (원칙 IV)
```

- 실제 곡 설명 3~5건으로 후보 품질 육안 확인(한국곡 포함), `ai_ms`·`total_ms`가
  15s 예산 내인지 event_log에서 확인.
- Render 배포 시: 환경변수 `OPENAI_API_KEY`, `AI_MODEL`(기본 gpt-5-mini),
  `AI_QUOTA_GUEST_DAILY`/`AI_QUOTA_USER_DAILY`(선택), `AI_REASONING_EFFORT`(선택,
  기본 minimal — 비reasoning 모델로 교체 시 `none`) 등록. **웜업 후 측정**(콜드스타트 유의).

## 7. 계측·SC 확인

```sql
-- 요청·결과 분포
select properties->>'outcome' as outcome, count(*),
       percentile_cont(0.95) within group (order by (properties->>'total_ms')::int) as p95_ms
from event_log where type = 'ai_search_request' group by 1;

-- 채택률(SC-002)
select (select count(*) from event_log where type='ai_search_select')::float
     / nullif((select count(*) from event_log where type='ai_search_request'
               and properties->>'outcome' in ('hit','empty')), 0);
```

이벤트 4종(`ai_fallback_open`/`ai_search_request`/`ai_search_select`/`ai_search_cancel`)이
모두 적재되는지 확인 — 계측 없이 병합 금지(원칙 III).

## 병합 게이트 (기존 규칙 + 본 기능 추가분)

- [ ] backend 빌드 + validate 통과, frontend build 통과
- [ ] mock E2E: 위 1~5 시나리오 통과 (`acr-mock,ai-mock`)
- [ ] backend-prd §6.1 / frontend-prd §8 계약 동기화 — 같은 PR (원칙 II)
- [ ] OPENAI_API_KEY 등 시크릿이 커밋에 포함되지 않음 (원칙 IV)
