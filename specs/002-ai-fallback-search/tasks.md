# Tasks: AI 자연어 폴백 검색

**Input**: Design documents from `/specs/002-ai-fallback-search/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/search-text-api.md, quickstart.md

**Tests**: 전면 TDD는 요구되지 않음. constitution 병합 게이트(빌드+validate+**mock E2E**)와
기존 백엔드 테스트 관행을 지키는 데 필요한 테스트 태스크만 포함(ai-key 유틸 단위 테스트,
TextSearchService 단위 테스트, mock E2E 검증).

**Organization**: 유저 스토리 단위 그룹핑 — US1(P1)만 완료해도 MVP로 배포 가능.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일·미완료 태스크 의존 없음)
- **[Story]**: US1/US2/US3 (유저 스토리 페이즈에만)

## Path Conventions

웹 모노레포: `backend/src/main/java/com/melolist/...`, `frontend/src/...` (plan.md 구조 참조)

---

## Phase 1: Setup (Spring AI 도입)

**Purpose**: OpenAI 호출 스택과 설정 기반 마련

- [X] T001 backend/build.gradle에 `dependencyManagement` 블록 신설 + Spring AI BOM(구현 시점 최신 안정판으로 버전 고정, R2) + `spring-ai-starter-model-openai` 추가, 빌드 통과 확인
- [X] T002 [P] backend/src/main/resources/application.yml에 `spring.ai.openai.api-key=${OPENAI_API_KEY:}`·모델 옵션(`${AI_MODEL:gpt-5-mini}`) + `melolist.ai.*`(timeout-ms 10000, quota.guest-daily 3, quota.user-daily 10, mock.scenario `${AI_MOCK_SCENARIO:hit}`) 추가, backend/.env(미추적)에 OPENAI_API_KEY 항목 추가
- [X] T003 [P] backend/src/main/java/com/melolist/search/config/AiProperties.java — `melolist.ai.*` 바인딩 record 생성(@ConfigurationProperties) 및 등록

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 클라이언트·quota·upsert 확장. **⚠️ 이 페이즈 완료 전 스토리 착수 금지**

- [X] T004 backend/src/main/java/com/melolist/search/client/AiSongFinderClient.java — 후보 식별 인터페이스 + 내부 후보 record(title, artists 배열, album) 정의(계약: 최대 5곡, 실패는 예외)
- [X] T005 backend/src/main/java/com/melolist/search/client/OpenAiSongFinderClient.java — `@Profile("!ai-mock")`, Spring AI ChatClient + 구조화 출력(entity 바인딩), 실존 곡만·최대 5곡 프롬프트, 10s 컷(가상 스레드 orTimeout, R7). Spring AI 버전·reasoning 옵션 노출 여부 확인(R2 확인사항) 포함
- [X] T006 [P] backend/src/main/java/com/melolist/search/client/mock/MockAiSongFinderClient.java — `@Profile("ai-mock")`, `AI_MOCK_SCENARIO` 4종(hit: 고정 3곡 / empty / error / slow: 12s 지연, R9)
- [X] T007 [P] backend/src/main/java/com/melolist/music/dto/MusicUpsertCommand.java에 source 필드 추가 + music/service/MusicService.java upsert에 source 반영(기존 호출부 "ACRCLOUD" 기본값 유지), 기존 테스트 갱신
- [X] T008 [P] backend/src/main/java/com/melolist/event/repository/EventLogRepository.java — 일일 카운트 쿼리 추가(type='ai_search_request', user_id 또는 session_id, Asia/Seoul 당일, properties outcome<>'quota' 제외 — data-model §1)
- [X] T009 backend/src/main/java/com/melolist/search/service/AiQuotaService.java — 게스트 3/로그인 10 판정, 초과 시 예외 → common의 전역 예외 처리기에 `AI_QUOTA_EXCEEDED`(429, details.limit/reset_at)·`AI_UPSTREAM_ERROR`(502)·`INVALID_QUERY`(400)·`INVALID_CANDIDATE`(400) 표준 바디 매핑 추가
- [X] T010 [P] backend/src/main/java/com/melolist/search/service/AiKeyGenerator.java — 정규화(트림·소문자·공백 축약)+sha256 앞 16 hex `ai-` 키 생성 유틸 + backend/src/test/java/.../AiKeyGeneratorTest.java 단위 테스트(정규화 동치·충돌 케이스)

**Checkpoint**: 기반 완료 — US1 착수 가능

---

## Phase 3: User Story 1 - 검색 실패 후 말로 이어서 찾기 (Priority: P1) 🎯 MVP

**Goal**: 미매칭 결과 화면 → 텍스트 설명 → 후보 최대 5곡(기존 카드 형태) → 선택 시 저장·후속 행동. 게스트 사용 가능

**Independent Test**: `SPRING_PROFILES_ACTIVE=acr-mock,ai-mock`로 기동, quickstart §1·3·4·5 시나리오(hit 후보 표시 → 선택 저장·dedup → 즐겨찾기 연동 → 429) 통과

### Implementation for User Story 1 — Backend

- [X] T011 [P] [US1] backend/src/main/java/com/melolist/search/dto/ — TextSearchRequest(query 트림 후 2~200자 Bean Validation), TextSearchResponse(results: 기존 AcrResult 호환 — acrid=ai-key, artists 배열, score/release_date null 허용), TextSelectRequest(candidate+rank) 생성 (contracts §1·2)
- [X] T012 [US1] backend/src/main/java/com/melolist/search/service/TextSearchService.java — 검색 오케스트레이션: quota 검사(T009) → AiSongFinderClient 호출 → 후보별 `AcrMetadataClient.lookup` 병렬 enrich(가상 스레드·기존 4s 컷·`resolveCoverUrl` 재사용) → 응답 조립 → `ai_search_request` recordSilently({query_len, ai_ms, meta_ms, total_ms, candidates, outcome})
- [X] T013 [US1] TextSearchService에 select 처리 추가 — ai-key 재계산·acrid 일치 검증(불일치 INVALID_CANDIDATE) → MusicService upsert(acrid=ai-key, source="AI") → JWT 있으면 search_history(TEXT/MATCHED) 기록 → `ai_search_select`({rank, ai_key, resolved}) 기록 (data-model §3)
- [X] T014 [US1] backend/src/main/java/com/melolist/search/web/SearchController.java — `POST /api/search/text`·`POST /api/search/text/select` 추가(X-Session-Id 필수·JWT 옵션) + common/config/SecurityConfig.java에 `/api/search/text/select` permitAll 추가
- [X] T015 [P] [US1] backend/src/test/java/com/melolist/search/service/TextSearchServiceTest.java — mock 클라이언트로 hit/empty/error/quota/셀렉트 위조 검증 단위 테스트

### Implementation for User Story 1 — Frontend

- [X] T016 [P] [US1] frontend/src/features/search/api.ts에 `textSearch(query, signal)`(기존 `RECOGNIZE_TIMEOUT_MS` 15s 타임아웃 재사용)·`selectCandidate(candidate, rank)` 추가 + types.ts의 AcrResult score·release_date null 허용 완화 (contracts §4)
- [X] T017 [US1] frontend/src/features/search/FallbackSearchView.tsx — 텍스트 입력(2~200자 카운터·범위 밖 사전 안내), 진행 상태+취소, 후보 목록(기존 카드·CoverArt 재사용, score null이면 일치율 배지 미표시, 링크 null 후보는 링크 없이 표시), 빈 결과(`results:[]`)의 기본 상태(간단한 "찾지 못했어요" 안내) 포함 — 단서 예시·재시도 고도화는 US3(T026)에서
- [X] T018 [US1] frontend/src/pages/SearchPage.tsx — Phase 상태머신에 fallback 단계 추가(F2 미매칭 → 폴백 진입 → 검색 중 → 후보), AbortController 재사용, 후보 선택 시 selectCandidate 확정 후 기존 결과 확정 흐름(즐겨찾기 acrid=ai-key) 연결
- [X] T019 [P] [US1] frontend/src/features/search/FailureView.tsx — F2(무결과)에 "말로 설명해서 찾기" CTA 추가(기존 F2 지문→허밍 전환 CTA 패턴)
- [X] T020 [P] [US1] frontend/src/features/events/track.ts EventType에 `ai_fallback_open`·`ai_search_cancel` 추가 + 발화 연결, frontend/src/mock/searchMock.ts에 ai 폴백 mock 시나리오 추가
- [X] T021 [US1] 429/502 처리 — FallbackSearchView에 한도 안내(details.reset_at 표시)·F4 오류 패턴+재시도, 서버 message 직접 렌더 금지 규칙 준수
- [X] T022 [US1] mock E2E 검증 — specs/002-ai-fallback-search/quickstart.md §1·3·4·5 시나리오 실행·통과 확인(acr-mock,ai-mock 병행)

**Checkpoint**: US1 단독으로 완전 동작 = MVP. 여기서 배포 가능

---

## Phase 4: User Story 2 - 잘못 매칭된 결과에서 폴백으로 전환 (Priority: P2)

**Goal**: 매칭 성공 결과 화면에서 "찾는 곡이 아닌가요?" → 동일 폴백 진입, 원래 결과 복귀 가능

**Independent Test**: `AI_MOCK_SCENARIO=hit` + acr-mock hit로 매칭 결과 화면 → 진입점 탭 → 폴백 흐름 동작 + 뒤로가기로 원래 결과 복귀 확인

- [X] T023 [US2] frontend/src/features/search/ResultsView.tsx — "찾는 곡이 아닌가요?" 진입점 추가(지문 히어로형·허밍 리스트형 모두), `ai_fallback_open(from=mismatch)` 발화
- [X] T024 [US2] frontend/src/pages/SearchPage.tsx — results → fallback 전환 시 기존 결과 상태 보존, 폴백에서 복귀(뒤로가기) 시 원래 매칭 결과 복원 (spec US2 AS-2)
- [ ] T025 [US2] 검증 — 결과→폴백→복귀 왕복 시나리오 수동 확인 + specs/002-ai-fallback-search/quickstart.md에 US2 확인 절차 1줄 추가 *(⏳ 07-21: quickstart 절차 추가·복원 로직 구현 완료 — UI 왕복 수동 확인만 남음, 사용자 로컬)*

**Checkpoint**: US1+US2 동작 — 미매칭·오매칭 두 진입점 모두 완성

---

## Phase 5: User Story 3 - 후보가 없거나 아닐 때 보완해서 재시도 (Priority: P3)

**Goal**: 무후보 시 단서 안내 + 입력 유지 재시도, 후보 목록에서도 재설명 가능

**Independent Test**: `AI_MOCK_SCENARIO=empty`로 무후보 안내(단서 예시 포함) 표시 → 입력 보완 → 재검색 동작 확인(quickstart §2)

- [X] T026 [US3] frontend/src/features/search/FallbackSearchView.tsx — 무후보 상태: 오류가 아닌 안내(가사·발표 시기·장르 등 단서 예시) + 이전 입력 유지 수정·재시도, 후보 목록 하단 "다시 설명하기" 액션 (spec US3 AS-1·2)
- [ ] T027 [US3] 검증 — quickstart.md §2(empty 재시도 루프) 시나리오 통과 확인 *(⏳ 07-21: 서버 empty=200 빈 배열 검증 완료 — UI 재시도 루프 수동 확인만 남음, 사용자 로컬)*

**Checkpoint**: 전 스토리 독립 동작

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T028 [P] 계약 동기화(원칙 II — 구현과 같은 PR): docs/prd/backend-prd.md §6.1에 엔드포인트 2개+이벤트 사전 4종 병합·§6.2의 `/search/text` 행 이관 확정, docs/prd/frontend-prd.md §8에 AcrResult 완화·API 함수 반영 (contracts/search-text-api.md 그대로)
- [X] T029 [P] backend/db/queries/kr_metrics.sql에 SC-001~004 산출 쿼리 추가 (contracts §3의 SQL 스케치 기반)
- [X] T030 실키 스모크(quickstart §6) — ✅07-22 로컬 완료: 실쿼리 7건(한국곡 4·팝 1·다후보 1·무후보 1) **전부 정답 1순위**, ai_ms 0.9~3.9s·total_ms 최대 7.3s(15s 예산 내). **발견: gpt-5-mini는 2026-12-11 종료 예정(deprecated) + 5.4 계열은 reasoning_effort 'minimal' 미지원(400)** → 기본값을 gpt-5.4-mini + low로 상향(yml·AiProperties). 단가 재확인: gpt-5.4-mini $0.75/$4.50 per 1M → 쿼리당 ~3원(여전히 무시 가능). 테스트 이벤트 13건 DB 정리함. ⏳잔여: Render 환경변수 OPENAI_API_KEY 등록(배포 시점, AI_MODEL은 기본값이 5.4-mini라 불필요) 및 웜업 후 운영 확인
- [X] T031 병합 게이트 최종 확인 — ✅07-22 완료: T030 후 backend build+테스트 33건 재통과(기본값 변경 포함), 나머지(frontend build, mock E2E 18건, 시크릿 미추적, 텍스트 전용 페이로드)는 07-21 확인분 유효. 시크릿은 backend/.env(미추적)에만 존재 재확인

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1(Setup)**: 즉시 시작. T001 → T002·T003 [P]
- **Phase 2(Foundational)**: Phase 1 완료 후. T004 → T005·T006, T007·T008·T010은 [P] 독립, T009는 T008 이후. **모든 스토리를 블로킹**
- **Phase 3(US1)**: Phase 2 완료 후. 백엔드(T011→T012→T013→T014→T015)와 프론트(T016→T017→T018→T021, T019·T020 [P])는 병렬 트랙 가능, T022는 양쪽 완료 후
- **Phase 4(US2)**: US1의 폴백 화면(T017·T018) 재사용 — US1 완료 후 착수 권장(프론트 전용)
- **Phase 5(US3)**: US1의 FallbackSearchView 확장 — US1 완료 후 착수 가능(US2와는 독립, 병렬 가능)
- **Phase 6(Polish)**: 채택 스토리 완료 후. T028·T029 [P]

### User Story Dependencies

- **US1(P1)**: Foundational만 의존 — 단독 MVP
- **US2(P2)**: US1의 폴백 화면 컴포넌트 재사용(진입점만 추가) — US1 이후
- **US3(P3)**: US1의 폴백 화면 상태 확장 — US1 이후, US2와 병렬 가능

### Parallel Opportunities

```text
Phase 2:  T006 ∥ T007 ∥ T008 ∥ T010   (T004 완료 후)
Phase 3:  백엔드 트랙(T011~T015) ∥ 프론트 트랙(T016~T021 중 T019·T020 병렬)
Phase 4∥5: US2(T023~T025) ∥ US3(T026~T027)   (US1 완료 후)
Phase 6:  T028 ∥ T029
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1 → Phase 2 → Phase 3(US1) 완료
2. **STOP & VALIDATE**: quickstart §1~5 mock E2E + 실키 스모크 최소 1건
3. 이 시점 배포 가능 — 미매칭 폴백만으로도 핵심 가치(실패 세션 구제) 전달

### Incremental Delivery

- US1 병합·배포(MVP) → US2(오매칭 진입점) → US3(재시도 UX) → Polish
- 1인 개발 기준 권장 PR 단위: **전체를 한 브랜치·한 PR**(API+화면 동시 변경 — 원칙 II)로 하되, 커밋은 Phase 단위 Conventional Commits(`feat(backend):`/`feat(frontend):`)
- 브랜치: `feat/m5-ai-fallback-search`

---

## Notes

- 신규 테이블·마이그레이션 0 — DB 작업 태스크 없음(data-model.md 참조)
- 이벤트 4종(ai_fallback_open/ai_search_request/ai_search_select/ai_search_cancel)은 T012·T013·T020에 내장 — 계측 없이 병합 금지(원칙 III)
- OPENAI_API_KEY는 backend/.env(미추적)와 Render 환경변수에만 — 커밋 금지(원칙 IV)
