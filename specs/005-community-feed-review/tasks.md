# Tasks: 커뮤니티 — 공개 탐색 피드·서비스 리뷰·댓글

**Input**: Design documents from `/specs/005-community-feed-review/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/community-api.md, quickstart.md

**Tests**: 포함 — constitution 원칙 VI(병합 게이트 GREEN)과 plan의 테스트 백필 결정(R1 갭 ⑤)에 따라
서비스 단위 테스트(backend)·vitest(frontend)를 해당 스토리 안에서 함께 작성한다. 얇은 계층
(controller·DTO 애너테이션)은 기존 관례대로 단위 테스트 대상에서 제외한다.

**Organization**: 유저 스토리 단위 — 각 스토리는 독립 구현·독립 검증 가능한 증분이다.

**주의(파일 충돌)**: `frontend/src/features/community/api.ts`는 T009→T014→T021→T031이 순차로
확장한다(스토리 순서 준수 시 충돌 없음). `CommunityPage.tsx`는 US1이 만들고 US2가 확장한다.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

**Purpose**: 신규 feature 모듈 뼈대와 공용 계측 타입 — 이후 모든 스토리가 사용

- [X] T001 `frontend/src/features/community/api.ts` 신설 — 공통 타입만 먼저 정의: `AuthorSummary {id, display_name, avatar_url}`, 페이지 응답 제네릭 `Page<T> {items, page, size, total_items, total_pages}` (snake_case — 계약 §7 케이싱 주의)
- [X] T002 [P] `frontend/src/features/events/track.ts` — `EventType` 유니온에 5종 추가: `community_view`·`review_prompt_shown`·`review_prompt_later`·`review_submit`·`comment_submit` (계약 §5)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 보안 매처 실사 — 신설 인증 전용 경로가 기존 게스트 개방 매처에 삼켜지지 않게 선확인

- [X] T003 `backend/src/main/java/com/melolist/common/config/SecurityConfig.java` 수정(**필수 — analyze F1 실사 확정**): 49행 `GET "/api/reviews", "/api/reviews/*"` permitAll 와일드카드가 US4의 `GET /api/reviews/prompt`를 삼킨다. 48행 `/api/reviews/me` 선례처럼 `/api/reviews/prompt`를 `.authenticated()`로 **permitAll보다 먼저 선언**한다

**Checkpoint**: 도메인·테이블·이벤트 수집기는 기존 완비(research.md R1) — 이후 스토리 착수 가능

---

## Phase 3: User Story 1 - 커뮤니티 탐색: 공개 플레이리스트 피드 (Priority: P1) 🎯 MVP

**Goal**: 게스트 포함 누구나 커뮤니티 탭에서 공개 플레이리스트 피드(작성자 닉네임 포함)를 보고 상세로 이동

**Independent Test**: 공개 플레이리스트 ≥1 상태에서 게스트로 커뮤니티 탭 진입 → 피드 표시 → 항목 탭 → 공개 상세 이동 (quickstart 시나리오 1~4; 리뷰 세그먼트는 이 단계에선 빈 상태로 동작)

### Implementation for User Story 1

- [X] T004 [P] [US1] `backend/src/main/java/com/melolist/community/dto/CommunityDtos.java` 신설 — `CommunityPlaylistResponse`(기존 PlaylistResponse 필드 + `author: AuthorSummary`, snake_case) (계약 §1)
- [X] T005 [P] [US1] `backend/src/main/java/com/melolist/user/service/UserService.java` — 프로필 일괄 조회 메서드 추가(`Map<UUID, Profile> getProfileMap(Collection<UUID>)`, `findAllById` 기반 — R4 N+1 방지)
- [X] T006 [US1] `backend/src/main/java/com/melolist/community/service/CommunityService.java` 신설 — `getPublicFeed(Pageable)`: `PlaylistService.getPublicPlaylists` 위임 → ownerId 수집 → T005 일괄 조회 → `CommunityPlaylistResponse` 매핑 (depends on T004, T005)
- [X] T007 [US1] `backend/src/main/java/com/melolist/community/web/CommunityController.java` — `GET /api/community/playlists` 응답을 `PageResponse<CommunityPlaylistResponse>`로 교체(CommunityService 위임으로 변경)
- [X] T008 [P] [US1] `backend/src/test/java/com/melolist/community/service/CommunityServiceTest.java` 신설 — 작성자 매핑(정상·프로필 결손 시 null author 안전)·페이지 메타 보존 검증
- [X] T009 [US1] `frontend/src/features/community/api.ts` — 피드 타입 `CommunityPlaylistItem`+`fetchCommunityPlaylists(page, size=20)` 추가
- [X] T010 [US1] `frontend/src/pages/CommunityPage.tsx` 신설 — 목록 화면 뼈대(FavoritesPage 캐논: 컨테이너·헤더+ThemeToggle·h1·guest→loading 스켈레톤→error→empty→목록 분기, `authStore.initialized` 가드는 불필요 — 게스트 허용 화면) + 수동 2버튼 세그먼트(플레이리스트/리뷰 — plan 설계 유의점, 리뷰 세그먼트는 빈 상태 placeholder) + 플레이리스트 피드(useInfiniteQuery `['community-playlists']`+"더 보기", 카드=PlaylistsPage `PlaylistRow` 변형에 작성자 닉네임·아바타 추가, 탭→`/playlists/:id`) + `community_view {segment}` 계측(진입·세그먼트 전환)
- [X] T011 [P] [US1] `frontend/src/components/BottomNav.tsx` TABS에 커뮤니티(`/community`, lucide `Users` 계열 아이콘) 추가 + `frontend/src/routes/router.tsx` TabLayout children에 `/community` 라우트 추가
- [X] T012 [US1] 체크포인트 검증 — `backend: .\gradlew.bat build` GREEN + `frontend: npm run build` 통과 + 로컬 quickstart 시나리오 1~4 확인

**Checkpoint**: US1 단독으로 배포·시연 가능한 MVP

---

## Phase 4: User Story 2 - 서비스 리뷰 작성·수정·삭제와 리뷰 피드 (Priority: P2)

**Goal**: 로그인 사용자가 별점+텍스트(≤500자) 리뷰를 1인 1건 작성·수정·삭제하고, 리뷰 피드는 게스트 포함 조회

**Independent Test**: 리뷰 작성 → 피드 노출 → 재작성 409 → 수정 유도 → 수정·삭제 반영 (quickstart 시나리오 5~10)

### Implementation for User Story 2

- [X] T013 [P] [US2] `backend/src/main/java/com/melolist/community/dto/ReviewDtos.java` — `CreateRequest.content`·`UpdateRequest.content`에 `@Size(max = 500)` 추가 (R2)
- [X] T014 [US2] `frontend/src/features/community/api.ts` — 리뷰 타입 `Review`+함수 5종 추가: `fetchReviews`·`fetchMyReview`(404→null 처리)·`createReview`·`updateReview`·`deleteReview`
- [X] T015 [US2] `frontend/src/features/community/ReviewFormSheet.tsx` 신설 — BottomSheet 셸+PlaylistFormSheet 폼 관행 재사용. 별점 입력(1~5 필수, `--color-warning` amber 토큰)+textarea(`maxLength` 500·남은 글자 수)+작성/수정 겸용(열릴 때 초기값 리셋)+409 응답 시 "이미 작성" 안내 후 수정 모드 전환(계약 §6)+성공 시 `review_submit {rating, is_edit}` 계측·`['reviews']` 캐시 무효화
- [X] T016 [US2] `frontend/src/pages/CommunityPage.tsx` 리뷰 세그먼트 구현 — 리뷰 피드(useInfiniteQuery `['reviews']`+"더 보기", 카드: 별점·내용 `whitespace-pre-wrap` 플레인 텍스트 렌더(R9 — `dangerouslySetInnerHTML` 금지)·닉네임·아바타·작성일) + "리뷰 쓰기" CTA(게스트→GuestPrompt 패턴 `/login` state.next 복귀, 로그인+기존 리뷰 있으면 수정 시트로) + 본인 리뷰 행에 수정·삭제 진입점(삭제는 BottomSheet 확인 — PlaylistDetailPage 관행)
- [X] T017 [P] [US2] `frontend/src/features/community/__tests__/ReviewFormSheet.test.tsx` 신설(vitest) — 별점 미선택 제출 차단·500자 초과 입력 차단·409 시 수정 모드 전환 콜백 검증
- [X] T018 [US2] 체크포인트 검증 — build+vitest GREEN + 로컬 quickstart 시나리오 5~10 확인(XSS 원문 렌더·길이 400 포함)

**Checkpoint**: US1+US2 — 커뮤니티 화면 완성(두 세그먼트 모두 실데이터)

---

## Phase 5: User Story 3 - 공개 플레이리스트 댓글 (Priority: P3)

**Goal**: 공개 플레이리스트 상세에서 댓글 조회(게스트 포함)·작성(로그인, ≤300자)·본인 삭제

**Independent Test**: 공개 상세에서 댓글 작성 → 목록 노출 → 게스트 조회 → 본인 삭제, 비공개 전환 시 작성 거부 (quickstart 시나리오 11·12)

### Implementation for User Story 3

- [X] T019 [P] [US3] `backend/src/main/java/com/melolist/community/dto/CommentDtos.java` — `CreateRequest.content`에 `@Size(max = 300)` 추가 (R2). `parentId`는 계약상 예약 — 코드 변경 없음(R3)
- [X] T020 [P] [US3] `backend/src/test/java/com/melolist/community/service/CommentServiceTest.java` 신설(R1 갭 ⑤ 백필) — 공개 플레이리스트 검증 위임·비공개/없음 404·본인 아님 삭제 403·대댓글 규칙(다른 플레이리스트 부모 거부·2단 거부)·삭제 시 연쇄 삭제
- [X] T021 [US3] `frontend/src/features/community/api.ts` — 댓글 타입 `Comment`+함수 3종 추가: `fetchComments(playlistId)`·`createComment(playlistId, content)`·`deleteComment(id)` (`parent_id`는 보내지 않음)
- [X] T022 [US3] `frontend/src/features/community/CommentsSection.tsx` 신설 — `useQuery ['comments', playlistId]` 목록(asc, 닉네임·아바타·작성 시각, 플레인 텍스트 렌더)+입력창(`maxLength` 300, 로그인 사용자만·게스트는 인라인 로그인 CTA — 상세 화면엔 GuestPrompt 없음(plan 구조 노트), `/login` state.next 복귀)+본인 댓글 삭제(확인 시트)+404 응답 시 "더 이상 공개된 플레이리스트가 아니에요" 카피+성공 시 `comment_submit {playlist_id}` 계측
- [X] T023 [US3] `frontend/src/pages/PlaylistDetailPage.tsx` — 트랙 목록(`motion.ul`) 아래·하단 시트들 위에 `CommentsSection` 부착(공개 항목 또는 소유자일 때 렌더), `pb-28` 여백과 간섭 없는지 확인
- [X] T024 [US3] 체크포인트 검증 — backend build(테스트 포함)+frontend build GREEN + 로컬 quickstart 시나리오 11·12 확인

**Checkpoint**: US1~US3 — 조회·작성 상호작용 전부 동작

---

## Phase 6: User Story 4 - 리뷰 작성 유도 (Priority: P4)

**Goal**: 누적 검색 3회 도달한 리뷰 미작성 로그인 사용자에게 유도 1회 노출, "나중에"는 서버 7일 유예(기기 무관)

**Independent Test**: 신규 계정 acr-mock 검색 3회 → 유도 노출 → "나중에" → 유예 기간 내 미노출(타 브라우저 포함), 기작성자 미노출 (quickstart 시나리오 13~15)

### Implementation for User Story 4

- [X] T025 [P] [US4] `backend/src/main/resources/application.yml` — `melolist.review.prompt-defer-days: 7`·`prompt-search-threshold: 3` 추가 + `backend/src/main/java/com/melolist/community/config/ReviewProperties.java` 신설(record, 기존 AiProperties 관례의 `@ConfigurationProperties` 바인딩)
- [X] T026 [P] [US4] `backend/src/main/java/com/melolist/search/repository/SearchHistoryRepository.java` — `long countByUserId(UUID userId)` 추가 (R5)
- [X] T027 [US4] `backend/src/main/java/com/melolist/community/service/ReviewService.java` — `promptEligibility(UUID userId)` 추가: 리뷰 미작성 AND `review_hide_until` null/과거 AND `countByUserId ≥ threshold` → `ReviewDtos.PromptResponse {eligible}` 반환 (depends on T025, T026)
- [X] T028 [US4] `backend/src/main/java/com/melolist/community/web/ReviewController.java` — `GET /api/reviews/prompt`(인증) 추가, **`/{id}` 매핑보다 먼저 선언**(기존 `/me` 함정 — plan 유의점) + T003의 SecurityConfig 선선언과 함께 비로그인 호출이 401로 떨어지는지 확인
- [X] T029 [US4] `backend/src/main/java/com/melolist/user/` — `dto/ReviewVisibilityRequest.java` **신설**(관례가 레코드별 개별 파일 — analyze F2, 허용값 `later` 외 400), `service/UserService.java`에 `deferReviewPrompt(userId)`(`review_hide_until = now + defer-days`), `web/UserController.java`에 `PATCH /api/users/me/review-visibility` → 204 (계약 §3, R6)
- [X] T030 [P] [US4] `backend/src/test/java/com/melolist/community/service/ReviewServiceTest.java` — prompt 판정 4분기 케이스 추가(기작성/유예 중/검색<3/자격 충족). 유예 저장(`deferReviewPrompt`)은 단순 필드 세팅이라 기존 관례(얇은 계층 단위 테스트 제외)대로 생략 — quickstart 시나리오 14의 SQL 실증으로 검증 (analyze A1)
- [X] T031 [US4] `frontend/src/features/community/api.ts` — `fetchReviewPrompt()`·`deferReviewPrompt()` 추가
- [X] T032 [US4] `frontend/src/features/community/ReviewPromptSheet.tsx` 신설 — 노출 시 `review_prompt_shown` 계측, "작성하기"→ReviewFormSheet 연결, "나중에"→`deferReviewPrompt`+`review_prompt_later` 계측 후 닫기
- [X] T033 [US4] `frontend/src/pages/SearchPage.tsx` — 결과 표시 시점(`phase.name === 'results' && !phase.restored`, 기존 `search_result_shown` 발화 지점)에서 로그인 사용자만 `fetchReviewPrompt` 1회 조회(fire-and-check, 실패 무시) → eligible이면 **짧은 지연(약 2초) 후** ReviewPromptSheet 노출(결과 카드 확인 방해 금지 — spec US4-1), **세션당 1회 가드**(sessionStorage — 선택 없이 닫아도 세션 내 재노출 없음·유예 미저장, FR-010)
- [X] T034 [P] [US4] `frontend/src/features/community/__tests__/reviewPrompt.test.ts` 신설(vitest) — 게이팅 로직 검증: 게스트 미호출·복원 화면 미호출·세션 1회 가드
- [X] T035 [US4] 체크포인트 검증 — 전체 테스트 GREEN + 로컬 quickstart 시나리오 13~15 확인(유예는 Supabase SQL로 `review_hide_until` 실증)

**Checkpoint**: 전 스토리 완성 — 스펙 FR-001~FR-012 전부 충족

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T036 [P] PRD 동기화(constitution 원칙 II — 같은 PR 필수): `docs/prd/backend-prd.md` §6.1 이벤트 사전 5종·§6.2 community 행 갱신(M4 개통 표기, prompt·review-visibility 신설 반영) + `docs/prd/frontend-prd.md` §8 계약·§9 로드맵 M4 행 갱신 — 정본은 `specs/005-community-feed-review/contracts/community-api.md` 참조 표기
- [X] T037 최종 게이트 — `backend: .\gradlew.bat build`(전체 테스트) + `frontend: npm run build` + `npx vitest run` 전부 GREEN, 실패 시 원인 수정 후 재실행
- [X] T038 quickstart.md 전 시나리오(1~15) 로컬 E2E 최종 확인 + 검증 데이터 정리 SQL 실행(quickstart "검증 후 정리" 절) + 사용자 로컬 확인 요청

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음 — 즉시 시작
- **Foundational (Phase 2)**: T003은 독립 — US4 전까지만 완료되면 됨(권장: 초기)
- **User Stories (Phase 3~6)**: 우선순위 순차 실행(P1→P2→P3→P4). US2·US3·US4는 상호 독립이나
  `api.ts`·`CommunityPage.tsx` 공유로 순차가 안전. US4의 ReviewPromptSheet는 US2의
  ReviewFormSheet에 의존(유일한 스토리 간 의존)
- **Polish (Phase 7)**: 전 스토리 완료 후

### Parallel Opportunities

- T001·T002 (Setup 병렬)
- US1 내: T004·T005 병렬 → T006, T008·T011은 각각 T006·T010과 병렬 가능
- US2 내: T013은 프론트 작업(T014~T016)과 병렬
- US3 내: T019·T020 병렬(백엔드) ↔ T021~T023(프론트)과 교차 병렬
- US4 내: T025·T026 병렬 → T027, T030·T034는 구현 후 병렬

---

## Implementation Strategy

**MVP = Phase 1~3 (US1)**: 커뮤니티 탭+공개 피드만으로 배포 가능 — 기존 공개 플레이리스트
데이터로 즉시 가치. 이후 US2(리뷰)→US3(댓글)→US4(유도)를 증분 병합 없이 **한 브랜치·한
PR**로 이어간다(constitution 원칙 II — API·화면 동시 변경). 각 스토리 체크포인트(T012·
T018·T024·T035)에서 멈추고 검증한 뒤 다음 스토리로 진행한다. PR 생성은 T038(사용자 로컬
확인) 후, 병합은 사용자가 직접 수행한다(프로젝트 관례).
