# Tasks: 웹검색 심층 곡 탐색 (더 깊이 찾기)

**Input**: Design documents from `/specs/004-web-search-escalation/`

**Prerequisites**: plan.md, spec.md, research.md(R1~R10), data-model.md,
contracts/search-deep-api.md, quickstart.md

**Tests**: TDD 방식 요청됨 — 각 스토리에서 테스트를 먼저 작성해 RED 확인 후 구현으로
GREEN을 만든다(002 백엔드 관례와 동일. 프론트는 순수 로직 외 컴포넌트는 mock E2E로 검증).

**Organization**: 유저 스토리 단위 페이즈 — 각 스토리는 독립 구현·독립 검증 가능.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일·미완 태스크 의존 없음)
- **[Story]**: US1(무결과→심층 탐색), US2(불만족 전환·복귀), US3(한도 안내)

## Phase 1: Setup

**Purpose**: 설정 그라운드워크 — 신규 인프라 없음(기존 모노레포·기존 키 재사용)

- [X] T001 AiProperties에 `deep` 하위 설정 추가(timeoutMs=22000, userDaily=2) 및
      application.yml에 `melolist.ai.deep.*` 기본값 문서화 —
      `backend/src/main/java/com/melolist/search/config/AiProperties.java`,
      `backend/src/main/resources/application.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 두 파이프라인 공용 부품 + 계약 기반 — 모든 스토리가 의존

**⚠️ CRITICAL**: 이 페이즈 완료 전 유저 스토리 착수 금지

- [X] T002 [P] CandidateMetaVerifier 추출 대상 테스트 작성(RED) — 기존
      TextSearchService의 3단 대조·동명이곡 차단·정규화 케이스를 독립 검증 —
      `backend/src/test/java/com/melolist/search/service/CandidateMetaVerifierTest.java`
- [X] T003 CandidateMetaVerifier 추출 + TextSearchService 위임 리팩터링(GREEN) —
      **수용 기준: 기존 TextSearchServiceTest 전건 무변화 GREEN** —
      `backend/src/main/java/com/melolist/search/service/CandidateMetaVerifier.java`,
      `backend/src/main/java/com/melolist/search/service/TextSearchService.java`
- [X] T004 [P] 유튜브 videoId 추출·검증 유틸 테스트 작성(RED) — watch·youtu.be·shorts
      URL, 순수 11자 ID 수용 / 비유튜브 도메인·불량 패턴 거부(R5, §5.2 규칙) —
      `backend/src/test/java/com/melolist/search/client/YoutubeLinksTest.java`
- [X] T005 [P] WebSongCandidate record + WebSongFinderClient 인터페이스 + YoutubeLinks
      유틸 구현(GREEN — T004) —
      `backend/src/main/java/com/melolist/search/client/WebSongCandidate.java`,
      `backend/src/main/java/com/melolist/search/client/WebSongFinderClient.java`,
      `backend/src/main/java/com/melolist/search/client/YoutubeLinks.java`
- [X] T006 [P] SearchResponse.TrackResult `verified` 직렬화 테스트 작성(RED) — 심층
      응답=true/false 명시, 기존 경로=필드 자체 부재(NON_NULL) —
      `backend/src/test/java/com/melolist/search/dto/SearchResponseSerializationTest.java`
- [X] T007 SearchResponse.TrackResult에 `verified`(Boolean, NON_NULL) 추가(GREEN — T006)
      — 기존 계약 무변화 보장 —
      `backend/src/main/java/com/melolist/search/dto/SearchResponse.java`
- [X] T008 [P] SecurityConfig에 `/api/search/deep/**` authenticated 매처 추가 —
      **와일드카드 permitAll보다 앞에 등록(spec 001 삼킴 버그 교훈)** —
      `backend/src/main/java/com/melolist/common/config/SecurityConfig.java`

**Checkpoint**: 공용 부품·계약 기반 완료 — 스토리 착수 가능

---

## Phase 3: User Story 1 - AI 검색 무결과에서 "더 깊이 찾기" (Priority: P1) 🎯 MVP

**Goal**: 무결과 화면 → 확인 단계(프리필·잔여 횟수) → 웹검색 실행(진행·취소) → 후보
카드(미확인 배지·웹 링크) → 선택 시 저장(source=WEB, Type.DEEP)

**Independent Test**: quickstart §1 시나리오 1·2·3·6·7·8 — mock(ai-mock +
DEEP_MOCK_SCENARIO)만으로 전 흐름 검증, 게스트 401·이벤트 4종 적재 확인

### Tests for User Story 1 (RED first) ⚠️

- [X] T009 [P] [US1] AiQuotaService deep 한도 테스트 추가(RED) — 사용자 2회/일,
      Asia/Seoul 자정 리셋, usage(limit/used/remaining/resetAt) 계산, 무JWT 경로 없음 —
      `backend/src/test/java/com/melolist/search/service/AiQuotaServiceTest.java`
- [X] T010 [P] [US1] DeepSearchServiceTest 작성(RED) — ①라벨링은 필터가 아님(대조 실패
      후보 verified=false로 **유지**, 전부 미확인이어도 유지) ②verified=true는 카탈로그
      videoId·커버가 정본(웹 링크 무시) ③미확인은 웹 videoId+ytimg 파생 ④outcome
      hit/empty/error/quota별 `deep_search_request` props(web_ms·meta_ms·total_ms·
      candidates·unverified) ⑤쿼터 거절 시 outcome=quota 기록 후 429 ⑥select: ai-key
      불일치 400·upsert source=WEB·SearchHistory Type.DEEP·`deep_search_select`
      (rank/ai_key/resolved/verified) —
      `backend/src/test/java/com/melolist/search/service/DeepSearchServiceTest.java`
- [X] T011 [P] [US1] OpenAiWebSongFinderClientTest 작성(RED) — Responses API 응답
      파싱(후보 JSON 추출), 후보 URL→videoId 정규화(YoutubeLinks 위임), 불량 링크
      null 처리, 빈 응답=기권(빈 목록), 파싱 실패 예외 전파 —
      `backend/src/test/java/com/melolist/search/client/OpenAiWebSongFinderClientTest.java`

### Implementation for User Story 1 (GREEN)

- [X] T012 [US1] AiQuotaService에 deep 검사·잔여 조회 메서드 구현(T009 GREEN) —
      `countByTypeAndUserSince("deep_search_request", …)` 재사용 —
      `backend/src/main/java/com/melolist/search/service/AiQuotaService.java`
- [X] T013 [US1] OpenAiWebSongFinderClient 구현(T011 GREEN) — RestClient
      `POST /v1/responses`, `tools:[{type:"web_search"}]`, tool_choice auto+프롬프트
      유도(R2), 모델·키는 `spring.ai.openai.*` 값 주입 재사용, @Profile("!ai-mock") —
      `backend/src/main/java/com/melolist/search/client/OpenAiWebSongFinderClient.java`
- [X] T014 [P] [US1] MockWebSongFinderClient 구현 — @Profile("ai-mock"),
      `DEEP_MOCK_SCENARIO` 5종(hit/unverified/empty/error/slow — slow는 진행·취소
      검증용 지연) —
      `backend/src/main/java/com/melolist/search/client/mock/MockWebSongFinderClient.java`
- [X] T015 [P] [US1] SearchHistory.Type에 DEEP 추가 + DeepSelectRequest DTO
      (candidate+verified+rank) 작성 —
      `backend/src/main/java/com/melolist/search/domain/SearchHistory.java`,
      `backend/src/main/java/com/melolist/search/dto/DeepSelectRequest.java`
- [X] T016 [US1] DeepSearchService 구현(T010 GREEN) — search: 쿼터→웹호출 1회
      (orTimeout 22s)→dedupe·상한 5→CandidateMetaVerifier(8s 데드라인)→verified
      라벨링→계측→응답 / select: ai-key 검증→upsert(source=WEB)→기록(Type.DEEP)→계측 —
      `backend/src/main/java/com/melolist/search/service/DeepSearchService.java`
- [X] T017 [US1] SearchController에 `GET /deep/quota`·`POST /deep`·`POST /deep/select`
      + 쿼터 응답 DTO 추가(contracts §1~3 형태. 429는 코드 AI_QUOTA_EXCEEDED 유지하되
      메시지를 "심층 탐색" 문구로 분기 — 기존 예외 메시지 파라미터화) —
      `backend/src/main/java/com/melolist/search/web/SearchController.java`
- [X] T018 [P] [US1] 프론트 API·타입 — `deepQuota()`/`deepSearch(query, signal)`(타임아웃
      35s)/`selectDeepCandidate(candidate, rank)` + `AcrResult.verified?: boolean` —
      `frontend/src/features/search/api.ts`, `frontend/src/features/search/types.ts`
- [X] T019 [US1] DeepSearchFlow 컴포넌트 구현 — confirm(질의 프리필·수정·잔여 횟수·소요
      안내)→searching(진행 문구·취소)→candidates(미확인 배지·웹 링크 듣기·선택·♡)/
      empty/error/quota 상태머신 + `deep_search_open`/`deep_search_cancel` 계측 —
      `frontend/src/features/search/DeepSearchFlow.tsx`
- [X] T020 [US1] FallbackSearchView 무결과(empty) 상태에 진입점(from=ai_empty) 연결 +
      게스트 탭 시 기존 로그인 유도·복귀 패턴 연계 —
      `frontend/src/features/search/FallbackSearchView.tsx`,
      `frontend/src/pages/SearchPage.tsx`
- [X] T021 [US1] mock E2E 검증 — quickstart §1 시나리오 1·2·3·6·7·8 + event_log
      `deep_search_*` 적재 SQL 확인(사용자 로컬 확인 포함)

**Checkpoint**: US1 단독으로 MVP 동작 — 무결과 구제 전 흐름 + 저장 + 계측

---

## Phase 4: User Story 2 - 후보 불만족에서 심층 탐색 전환·복귀 (Priority: P2)

**Goal**: AI 폴백 후보 목록에서 "찾는 곡이 없나요?" 진입(from=ai_mismatch), 심층 결과에서
원래 후보 목록으로 복귀 가능

**Independent Test**: quickstart §1 시나리오 4 — mock 성공 시나리오에서 진입→심층
결과→"이전 결과로" 왕복 확인

### Implementation for User Story 2

- [X] T022 [US2] FallbackSearchView candidates 상태에 진입점 추가(from=ai_mismatch) +
      원래 후보 목록 보존·복귀 버튼(DeepSearchFlow onBack 경로) —
      `frontend/src/features/search/FallbackSearchView.tsx`,
      `frontend/src/features/search/DeepSearchFlow.tsx`
- [X] T023 [US2] mock E2E 검증 — quickstart §1 시나리오 4(왕복) + `deep_search_open`
      from=ai_mismatch 적재 확인

**Checkpoint**: US1·US2 진입점 2곳 모두 동작

---

## Phase 5: User Story 3 - 이용 한도 확인·소진 안내 (Priority: P3)

**Goal**: 확인 단계에서 잔여 0이면 실행 불가+리셋 시각 안내, 429 응답도 동일 화면 수렴,
심층 한도 소진과 무관하게 일반 AI 폴백 계속 동작

**Independent Test**: quickstart §1 시나리오 5 — 2회 소진 후 3회째 진입 시 안내, 일반
AI 폴백 정상

### Implementation for User Story 3

- [X] T024 [US3] DeepSearchFlow 소진 처리 마감 — confirm 진입 시 remaining=0이면 실행
      버튼 비활성+리셋 시각 안내, 검색 중 429 수신도 quota 상태 수렴(F4 규칙 —
      details.reset_at 사용) — `frontend/src/features/search/DeepSearchFlow.tsx`
- [X] T025 [US3] mock E2E 검증 — quickstart §1 시나리오 5(소진·독립성) +
      outcome=quota 이벤트가 카운트에서 제외됨(429 반복해도 리셋 전 한도 불변) 확인

**Checkpoint**: 전 스토리 독립 동작

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T026 [P] kr_metrics.sql에 심층 탐색 SC 절 추가(SC-001~005 산식 — contracts §4) —
      `backend/db/queries/kr_metrics.sql`
- [X] T027 [P] 계약 동기화(constitution 원칙 II — **같은 PR 의무**): contracts 내용을
      backend-prd §6.1(API 3개·이벤트 4종)과 frontend-prd §8(타입·타임아웃 35s)에 반영 —
      `docs/prd/backend-prd.md`, `docs/prd/frontend-prd.md`
- [X] T028 병합 게이트 — `./gradlew -p backend build` 전건 GREEN(기존 83건+신규 무회귀)
      + `npm run build`(tsc) + `npx vitest run`(기존 35건) 통과 확인
- [ ] T029 실키 스모크(선택 — 배포 전 1회, 비용 유의 2~3쿼리) — quickstart §3: 신곡
      질의 웹검색 발동(web_ms 15s+·미확인 후보 웹 videoId)·옛 곡 미발동 경로, Node
      스크립트 사용(한글 curl 인코딩 함정)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 없음 — 즉시 시작
- **Phase 2 (Foundational)**: T001 이후. **모든 스토리를 블로킹**
- **Phase 3 (US1)**: Phase 2 완료 후. 백엔드(T009~T017)와 프론트(T018~T020)는 계약
  문서 기준 병렬 가능
- **Phase 4 (US2)**: Phase 3의 T019(DeepSearchFlow)·T020(FallbackSearchView) 이후
- **Phase 5 (US3)**: Phase 3의 T019 이후(백엔드 쿼터는 T012에서 완료)
- **Phase 6 (Polish)**: 원하는 스토리 완료 후. T027은 병합 전 필수(원칙 II)

### Within Stories (TDD)

- 테스트(T002·T004·T006·T009·T010·T011)는 대응 구현 **전에 작성·RED 확인**
- T003→T016(Verifier를 서비스가 사용), T005→T013(YoutubeLinks 위임),
  T007→T016(응답 조립), T012·T013·T014·T015→T016→T017
- 프론트: T018→T019→T020(→T022·T024)

### Parallel Opportunities

- Phase 2: T002·T004·T006·T008 동시 착수 가능(서로 다른 파일)
- US1 테스트 3건(T009·T010·T011) 동시 작성 가능
- US1 구현 중 T014·T015는 T013·T016과 병렬 가능, T018(프론트)은 백엔드와 병렬
- Polish: T026·T027 병렬

## Parallel Example: User Story 1

```text
# RED 병렬:
Task: "AiQuotaServiceTest deep 한도 케이스 (T009)"
Task: "DeepSearchServiceTest 파이프라인·select (T010)"
Task: "OpenAiWebSongFinderClientTest 파싱·videoId (T011)"

# GREEN 병렬(계약 문서 기준):
백엔드: T012 → T013·T014·T015 → T016 → T017
프론트: T018 → T019 → T020
```

## Implementation Strategy

**MVP = Phase 1 + 2 + 3 (US1)**: 무결과 구제 전 흐름·저장·계측이 US1만으로 완결 —
여기서 멈추고 mock E2E(T021)로 검증·배포 가능. US2(진입점 1개 추가)·US3(소진 UX)은
증분이 작아 같은 PR에 이어 붙이는 것을 기본으로 하되, 각 체크포인트에서 독립 검증한다.
T029(실키 스모크)는 병합 전 로컬 1회 권장(운영 이벤트 오염 방지 — 테스트 후 세션 기준
정리 SQL은 사용자 실행).
