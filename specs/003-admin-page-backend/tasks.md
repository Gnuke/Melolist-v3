# Tasks: 관리자 어드민 — 운영 대시보드·데이터 관리 (백엔드)

**Input**: Design documents from `/specs/003-admin-page-backend/`

**Prerequisites**: plan.md · spec.md · research.md(D1~D10) · data-model.md · contracts/admin-api.md · quickstart.md

**Tests**: 포함 — plan D10이 단위 테스트를 게이트로 명시(TDD 순서 강제는 아님, 각 스토리 내 구현과 함께 작성).

**Organization**: 스토리별 독립 구현·검증 가능하도록 그룹화. 경로는 `backend/src/main/java/com/melolist/` 기준(이하 `~`로 표기), 테스트는 `backend/src/test/java/com/melolist/`(이하 `~test/`).

**⚠️ 전 태스크 공통 제약(FR-012·D4)**: 수정 허용 파일은 `Music.java`(T002)·`MusicService.java`(T018)·docs 2종(T031)뿐. 그 외는 전부 신규 파일. 기존 리포지토리는 주입해 기존 메서드만 재사용.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup (DB 스키마)

**Purpose**: 신규 테이블·컬럼 준비 — 모든 코드 작업의 전제

- [x] T001 Supabase 마이그레이션 `add_admin_audit_and_music_lock` 적용 — `alter table music add column meta_locked boolean not null default false` + `create table admin_audit_log`(id/admin_id/action/target_type/target_id/detail jsonb/created_at) + `(created_at)` 인덱스 (data-model §5, Supabase MCP `apply_migration` 사용)
- [x] T002 `Music` 엔티티에 `metaLocked` 필드 매핑 추가 in `~music/domain/Music.java` (`@Column(name = "meta_locked", nullable = false)` boolean, 기본 false — spec 002 미수정 파일)

---

## Phase 2: Foundational (인가·감사 — 모든 스토리의 전제)

**Purpose**: `/api/admin/**` 접근 제어(FR-001)와 감사 기록 기반(FR-011). 이 단계 없이는 어떤 스토리도 출고 불가

**⚠️ CRITICAL**: US1~US3 시작 전 완료 필수

- [x] T003 [P] `AdminAuthInterceptor` 구현 in `~admin/auth/AdminAuthInterceptor.java` — SecurityContext의 Jwt `sub` → `ProfileRepository.findById`(기존 메서드) → `role != 'ADMIN'`이면 기존 `ForbiddenException`("관리자 권한이 필요합니다.") throw. 프로필 없음도 Forbidden (research D1)
- [x] T004 [P] `AdminAuditLog` 엔티티 in `~admin/domain/AdminAuditLog.java` — data-model §1 컬럼 매핑, detail은 jsonb 문자열(`@JdbcTypeCode(SqlTypes.JSON)`) + action 상수(MUSIC_UPDATE/MUSIC_DELETE/REVIEW_DELETE/COMMENT_DELETE/PLAYLIST_UNPUBLISH)
- [x] T005 `AdminWebConfig` in `~admin/config/AdminWebConfig.java` — WebMvcConfigurer 추가 등록으로 T003 인터셉터를 `/api/admin/**` 패턴에만 적용 (SecurityConfig·CorsConfig 무수정)
- [x] T006 `AdminAuditLogRepository` in `~admin/repository/AdminAuditLogRepository.java` — JpaRepository 기본 메서드만(조회 API 없음)
- [x] T007 `AdminAuditService` in `~admin/service/AdminAuditService.java` — `record(adminId, action, targetType, targetId, before, after)` 헬퍼. 호출자 트랜잭션에 참여(REQUIRED — 별도 트랜잭션 금지, 변경과 원자성 보장 D5/SC-004)
- [x] T008 `AdminAuthInterceptorTest` in `~test/admin/auth/AdminAuthInterceptorTest.java` — ADMIN 통과 / USER 거부(ForbiddenException) / 프로필 없음 거부 / 역할 재조회(회수 즉시 반영) 검증

**Checkpoint**: 인가 로직 단위 테스트 GREEN (컨트롤러가 아직 없어 HTTP 403 확인은 US1 체크포인트에서)

---

## Phase 3: User Story 1 - 운영 지표 대시보드 (Priority: P1) 🎯 MVP

**Goal**: KR 지표(검색량·매칭률·p95·완료율·실패 분포·일별 추이)를 수작업 SQL 없이 API 1개로 제공

**Independent Test**: quickstart §2(인가 매트릭스 401/403/200) + §3 — 같은 기간의 `kr_metrics.sql` 수동 실행 값과 API 응답 일치(SC-006)

- [x] T009 [P] [US1] `AdminMetricsDtos` in `~admin/dto/AdminMetricsDtos.java` — contracts §1 응답 구조(period/search.modes/completion/failures/daily) record + `@JsonNaming(SnakeCaseStrategy)` (PageResponse 관례)
- [x] T010 [P] [US1] `AdminStatsRepository` in `~admin/repository/AdminStatsRepository.java` — `@Query(nativeQuery)` + 인터페이스 프로젝션: ① 모드별 rollup 통계(n/matched_n/p50/p95/max — `percentile_cont`, kr_metrics.sql KR2 정의 그대로) ② 완료율(visit·search_result_shown distinct 세션) ③ 실패 분포 ④ 일별 추이(방문 세션·search_request 수·profiles 가입 수, Asia/Seoul 일 경계) — 전부 `:fromTs`/`:toTs` 파라미터 (research D3) · event_log 쿼리는 전부 `event_type`+`created_at` 조건 포함으로 기존 인덱스 활용(FR-014)
- [x] T011 [US1] `AdminMetricsService` in `~admin/service/AdminMetricsService.java` — from/to 파싱(생략 시 최근 7일), Asia/Seoul 자정 경계 → Instant 변환, `from > to`면 IllegalArgumentException(기존 핸들러가 400), kr2_pass(전체 p95≤6000)·kr3_pass(≥70%)·빈 기간 0/null 처리 후 DTO 조립 · 기간 내 데이터 없는 날짜는 daily에 0으로 채움(contracts §1 — SQL이 아닌 서비스에서)
- [x] T012 [US1] `AdminMetricsController` in `~admin/web/AdminMetricsController.java` — `GET /api/admin/metrics?from=&to=` (contracts §1)
- [x] T013 [US1] `AdminMetricsServiceTest` in `~test/admin/service/AdminMetricsServiceTest.java` — 기간 기본값(7일)·경계 변환·from>to 400·빈 데이터 조립(n=0, pct=null) 검증 (native query 자체는 quickstart §3 실 DB 대조 — D10)

**Checkpoint**: 로컬 기동 → quickstart §2 인가 매트릭스(401/403/200) + §3 SC-006 대조 통과 — 여기까지가 MVP

---

## Phase 4: User Story 2 - 곡 데이터 정정 (Priority: P2)

**Goal**: MUSIC 캐시 검색·정정(잠금 보호)·삭제(참조 차단) + 전 변경 감사 기록

**Independent Test**: quickstart §4 — PATCH 후 `meta_locked=true`·사용자 화면 반영, 잠긴 곡 fillMissing 미변경(단위 테스트), 참조 곡 DELETE 409

- [x] T014 [P] [US2] `AdminMusicDtos` in `~admin/dto/AdminMusicDtos.java` — Summary(계약 필드)·Detail(+references 카운트)·UpdateRequest(Bean Validation: title `@NotBlank @Size(max=255)`, artist/album `@Size(max=255)`, youtube_video_id `@Pattern(^[A-Za-z0-9_-]{6,20}$)` null 허용, cover_url `@Pattern(^https?://.+)` `@Size(max=2048)` null 허용) (contracts §2)
- [x] T015 [P] [US2] `AdminMusicRepository` in `~admin/repository/AdminMusicRepository.java` — 목록 쿼리(query 없으면 전체 id desc, 있으면 제목·아티스트 부분일치 ignore case, Pageable) + 참조 카운트 쿼리(favorite·playlist_music·search_history.top_music_id 각각 count by music_id) (D4·D8)
- [x] T016 [US2] `AdminMusicService` in `~admin/service/AdminMusicService.java` — list(PageResponse)/get(+references)/update(전 필드 반영 → `metaLocked=true` 세팅 → AdminAuditService.record(MUSIC_UPDATE, before/after))/delete(참조 합>0이면 `ConflictException`에 "즐겨찾기 N·플레이리스트 N·검색기록 N" 메시지, 아니면 삭제+record(MUSIC_DELETE, before)) — 404는 기존 `NotFoundException`
- [x] T017 [US2] `AdminMusicController` in `~admin/web/AdminMusicController.java` — `GET /api/admin/music`·`GET /{id}`·`PATCH /{id}`·`DELETE /{id}`(204) (contracts §2) — 변경 작업의 수행자 ID는 `CurrentUser.id(jwt)`로 추출해 서비스에 전달(감사 기록용)
- [x] T018 [US2] `MusicService.fillMissing` 잠금 가드 추가 in `~music/service/MusicService.java` — 메서드 첫 줄 `if (existing.isMetaLocked()) return existing;` **단 1줄, 반드시 독립 커밋으로 분리**(D2 — spec 002 충돌면 최소화, 병합 순서 002→003)
- [x] T019 [US2] `MusicServiceTest` 신규 in `~test/music/service/MusicServiceTest.java` — 잠긴 곡 upsert 시 fillMissing 미적용(모든 필드 불변) + 안 잠긴 곡 기존 null-채움 동작 회귀 확인 (T018 완료 후)
- [x] T020 [US2] `AdminMusicServiceTest` in `~test/admin/service/AdminMusicServiceTest.java` — update가 metaLocked=true·audit 호출 / 참조 있는 delete가 ConflictException·audit 미호출 / 참조 없는 delete 성공·audit 호출 / 404

**Checkpoint**: quickstart §4 전 항목 + US1 회귀 없음

---

## Phase 5: User Story 3 - 사용자·콘텐츠 조회와 모더레이션 (Priority: P3)

**Goal**: 사용자 검색·활동 요약 + 리뷰·댓글 삭제·플레이리스트 비공개 전환(전부 감사 기록)

**Independent Test**: quickstart §5 — 리뷰 삭제 후 재작성 가능, unpublish 후 커뮤니티 미노출·소유자 유지, 대댓글 동반 삭제

- [x] T021 [P] [US3] `AdminUserDtos` in `~admin/dto/AdminUserDtos.java` — 목록 원소(id/email/display_name/role/created_at)·상세(+avatar_url, activity: search_count/favorite_count/playlist_count/has_review) (contracts §3)
- [x] T022 [P] [US3] `AdminModerationDtos` in `~admin/dto/AdminModerationDtos.java` — 리뷰 목록 원소(id/rating/content/created_at/author{id,email,display_name}) (contracts §4)
- [x] T023 [US3] `AdminStatsRepository`에 사용자 쿼리 추가 in `~admin/repository/AdminStatsRepository.java` — 사용자 검색(이메일·닉네임 부분일치, 가입 최신순, Pageable) + 활동 요약 카운트(search_history·favorite·playlist by user_id, review exists) — T010 이후 같은 파일(US3 단독 선행 시 이 파일을 사용자 쿼리만으로 신설)
- [x] T024 [US3] `AdminUserService` in `~admin/service/AdminUserService.java` — list(PageResponse)/get(+activity, 404)
- [x] T025 [US3] `AdminUserController` in `~admin/web/AdminUserController.java` — `GET /api/admin/users`·`GET /{id}` (contracts §3)
- [x] T026 [US3] `AdminModerationService` in `~admin/service/AdminModerationService.java` — ① 리뷰 목록(`ReviewRepository.findAll(PageRequest desc createdAt)` 기존 메서드 + author 매핑) ② 리뷰 삭제(+record REVIEW_DELETE) ③ 댓글 삭제(`deleteByParentId` → delete, 작성자 삭제와 동일 의미론 D7, +record COMMENT_DELETE) ④ unpublish(`isPublic=false`, 이미 비공개면 audit 없이 멱등 204, +record PLAYLIST_UNPUBLISH) — 전부 404는 NotFoundException
- [x] T027 [US3] `AdminModerationController` in `~admin/web/AdminModerationController.java` — `GET /api/admin/reviews`·`DELETE /api/admin/reviews/{id}`·`DELETE /api/admin/comments/{id}`·`POST /api/admin/playlists/{id}/unpublish`(전부 204) (contracts §4) — 변경 작업의 수행자 ID는 `CurrentUser.id(jwt)`로 추출해 서비스에 전달(감사 기록용)
- [x] T028 [US3] `AdminModerationServiceTest` in `~test/admin/service/AdminModerationServiceTest.java` — 대댓글 동반 삭제 / unpublish 멱등(재호출 audit 1회만) / 각 조치의 audit 기록 / 404

**Checkpoint**: quickstart §5 + §6(감사 기록 5종 누락 0건) — 전 스토리 독립 동작

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 게이트·실증·문서 동기화·PR 마무리

- [x] T029 전체 게이트 `./gradlew build` in `backend/` — 신규 테스트 포함 전체 GREEN + 기존 테스트 회귀 0건(SC-005, 원칙 VI)
- [x] T030 quickstart 전체 실행(§2~§7) — ✅2026-07-22 실 JWT E2E 완료: 인가 매트릭스(무토큰 401/관리자 200/기존 API 무영향)·지표 SC-006 실 SQL 대조 일치·days 검증 400·FR-014(days=90 0.54s)·곡 부분수정/비우기/잠금/409/404·역할 변경(승격·복귀·자기해제 409·허용외 400)·모더레이션(리뷰·대댓글 동반 삭제·unpublish 멱등)·감사 8행 누락 0건. 검증 중 발견한 missing 필터 500(JPQL null 바인딩 타입 추론 실패)은 빈 문자열 센티널로 수정 후 재검증 통과. 일반 사용자 403은 인터셉터 단위 테스트로 커버(tester1 토큰 없음)
- [ ] T031 실행 PRD 계약 반영 — `docs/backend-prd.md` §6.2에 admin 행 추가 + `docs/frontend-prd.md` §8에 어드민 계약 참조 추가 (**⚠️ spec 002 병합 → 본 브랜치 rebase 후 수행** — D9, 그 전엔 contracts/admin-api.md가 정본)
- [ ] T032 커밋 정리·PR 생성 — T018 가드가 독립 커밋인지 확인, Conventional Commits(`feat(backend): …`), PR 본문에 quickstart 결과·Complexity Tracking 예외 2건 명기

---

## Phase 7: 계약 동기화 (2026-07-22 — 프론트 트리 계약 정본 채택)

**Purpose**: 프론트 세션이 확정한 계약(`specs/003-admin-page-front/contracts/admin-api.md`)에
백엔드를 일치. 역할 변경 API 채택은 사용자 승인 완료(FR-002 개정). 전부 admin 패키지 내부
작업 — 공용 파일 무수정 원칙 유지.

- [x] T033 admin 전용 예외 체계 in `~admin/error/` — `AdminApiExceptionHandler`(`@RestControllerAdvice(basePackages)`, GlobalExceptionHandler 무수정)로 `INVALID_ARGUMENT`(+details.field)·`SELF_DEMOTION_FORBIDDEN`(409) 매핑 + 예외 2종
- [x] T034 지표 API 재작성 in `~admin/{dto,service,web,repository}` — `?days=`(기본14, 1~90) 롤링 윈도, `kr2.rows`(행별 pass)·`kr2_breakdown`(구간 분해 신규 쿼리)·`kr3`(pct null→pass false)·`weekly`(주간 추이 신규 쿼리, 기간 무관)·`totals`(누적 카운트 신규 쿼리)
- [x] T035 곡 관리 계약 일치 in `~admin/{dto,service,web,repository}` — `missing=video|cover` 필터(JPQL 동적 검색), 부분 수정(담긴 필드만·빈 문자열=비우기), `release_date` 편집 추가, videoId 11자 패턴, 응답에 release_date·duration_ms, size 상한 100·created_at desc
- [x] T036 사용자 계약 일치 + 역할 변경 API in `~admin/{dto,service,web}` — 목록에 avatar_url, `PATCH /users/{id}/role`(ADMIN|USER, 자기 해제 409, 같은 역할 멱등, audit `ROLE_CHANGE`)
- [x] T037 테스트 갱신·추가(AdminMetricsServiceTest 재작성, AdminMusicServiceTest 부분수정 의미론, AdminUserServiceTest 신규) + `./gradlew build` GREEN(테스트 49건) + 신규 쿼리(weekly·breakdown·누적) 실 Supabase 검증 + 부팅 스모크(401 매트릭스) 재통과

**Checkpoint**: front 계약 §0~§5 전 항목 일치. T030 실 JWT 검증에 역할 변경 항목 추가됨(quickstart §5)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 즉시 시작 가능. T002는 T001과 병행 가능(로컬 코드는 컬럼 존재 전에도 빌드됨)
- **Phase 2 (Foundational)**: T001·T002 이후. **모든 스토리를 블로킹**
- **Phase 3~5 (US1→US2→US3)**: 각각 Phase 2 완료 후 시작 가능. 스토리 간 코드 의존 없음(예외: T023이 T010과 같은 파일 — 순서대로 진행 시 자연 해소)
- **Phase 6 (Polish)**: 원하는 스토리 완료 후. T031은 **spec 002 병합 이후로 지연**

### Story Dependencies

- **US1 (P1)**: Foundational만 필요 — 독립
- **US2 (P2)**: Foundational + T007(감사) — US1과 독립. T018(공유 파일 가드)은 독립 커밋
- **US3 (P3)**: Foundational + T007(감사) — US1·US2와 독립(T023 파일 공유만 주의)

### Within Each Story

- DTO·Repository([P], 서로 다른 파일) → Service → Controller → Test → Checkpoint

### Parallel Opportunities

- Phase 2: T003 ∥ T004 (서로 다른 파일)
- US1: T009 ∥ T010 · US2: T014 ∥ T015 · US3: T021 ∥ T022
- 스토리 병행(예: US2와 US3 동시)도 가능하나 1인 개발이므로 우선순위 순차(P1→P2→P3) 권장

## Parallel Example: User Story 1

```text
# Phase 2 완료 후 동시 착수:
Task T009: AdminMetricsDtos in ~admin/dto/AdminMetricsDtos.java
Task T010: AdminStatsRepository in ~admin/repository/AdminStatsRepository.java
# 이후 순차: T011(Service) → T012(Controller) → T013(Test) → Checkpoint(quickstart §2·§3)
```

## Implementation Strategy

### MVP First (US1 = 지표 대시보드)

1. Phase 1(마이그레이션) → Phase 2(인가·감사) → Phase 3(US1)
2. **STOP & VALIDATE**: quickstart §2 인가 매트릭스 + §3 SC-006 대조 — 이 시점에 "SQL 없이 지표 확인"이라는 어드민의 핵심 가치가 이미 성립
3. 프론트 트리에 contracts/admin-api.md §1 소비 시작 가능 알림

### Incremental Delivery

- US1 검증 후 → US2(곡 정정) 추가 → quickstart §4 → US3(모더레이션) 추가 → quickstart §5·§6
- 각 체크포인트마다 커밋 — main 병합은 전 스토리 + Phase 6 완료 후 단일 PR(T031·T032는 spec 002 병합 후)

## Notes

- 수정 허용 파일 3종 외 전부 신규 파일 — 위반 발견 시 즉시 중단하고 설계 재검토(FR-012)
- T018은 반드시 독립 커밋(병합 순서 002→003, rebase 시 이 커밋만 충돌 검사하면 됨)
- 감사 기록은 변경과 같은 트랜잭션(REQUIRED) — 비동기·별도 트랜잭션 금지(SC-004)
- 신규 계약은 전부 snake_case(`@JsonNaming`) — PageResponse 관례 준수
