# Research: 관리자 어드민 백엔드 — 설계 결정

**Date**: 2026-07-22 · **Input**: spec.md + 현행 코드 분석(SecurityConfig·GlobalExceptionHandler·MusicService·kr_metrics.sql·PageResponse 등)

Technical Context에 NEEDS CLARIFICATION은 없다. 아래는 충돌 회피 제약 아래에서 검토한
설계 결정 10건이다.

## D1. 관리자 인가 방식 — 인터셉터 + 기존 예외 체계

- **Decision**: `AdminAuthInterceptor`(admin 패키지 신규)를 `/api/admin/**`에만 등록하는
  `AdminWebConfig`(WebMvcConfigurer 추가 등록, 신규 파일)로 인가한다. 인터셉터는
  SecurityContext의 JWT `sub` → `ProfileRepository.findById`(기존 메서드 재사용, 파일
  무수정) → `role != 'ADMIN'`이면 기존 `ForbiddenException`을 던진다(기존
  GlobalExceptionHandler가 403 + 표준 바디로 변환, preHandle 예외도 HandlerExceptionResolver를
  거쳐 @RestControllerAdvice에 도달). 게스트(무토큰)는 기존 `anyRequest().authenticated()`가
  401로 선차단 — SecurityConfig 무수정.
- **Rationale**: spec 002가 SecurityConfig·GlobalExceptionHandler를 수정 중이므로 두 파일
  모두 무수정이 1급 요구. 역할이 JWT 클레임이 아닌 `profiles.role`(DB)에 있으므로 요청
  시점 DB 판정이 필요하고(역할 회수 즉시 반영 — spec edge case), 관리자 1인 규모에서
  요청당 조회 1회는 무시 가능한 비용. 인터셉터 1곳이 admin 전 엔드포인트를 방어하므로
  컨트롤러별 가드 누락 사고가 구조적으로 불가능.
- **Alternatives considered**:
  - SecurityConfig에 `requestMatchers("/api/admin/**").hasRole("ADMIN")` — 002 충돌 +
    Supabase JWT에 앱 역할 클레임이 없어 authorities 매핑 커스터마이징(공용 설정 변경)까지 필요. 기각.
  - `@PreAuthorize` + 커스텀 빈 — Spring Security 6.3의 `AuthorizationDeniedException`이
    기존 catch-all(Exception→500)에 삼켜져 403이 아닌 500이 된다. 핸들러 추가는
    GlobalExceptionHandler 수정(002 충돌면). 기각.

## D2. FR-007 정정 보호 — `meta_locked` 잠금 + fillMissing 가드 1줄

- **Decision**: `music.meta_locked boolean not null default false` 컬럼을 추가하고, 관리자
  PATCH 성공 시 `true`로 세팅. `MusicService.fillMissing` 진입부에
  `if (existing.isMetaLocked()) return existing;` 가드 1줄을 추가한다. **이것이 본 기능의
  유일한 공유 파일 수정**이며, 독립 커밋으로 분리하고 spec 002 병합 후 rebase 한다
  (병합 순서: 002 → 003).
- **Rationale**: 현행 `fillMissing`은 null 필드만 채우므로 "값 교체"는 이미 안 덮인다.
  그러나 ① 관리자가 잘못된 필드를 **비운**(null) 경우 다음 인식이 같은 오염 값을 재주입하고,
  ② spec 002가 AI 출처 upsert 경로를 추가 중이라 쓰기 경로가 늘어난다 — 명시적 잠금이
  미래의 모든 경로에 대한 단일 방어선. 가드 위치가 메서드 첫 줄이라 002의 변경(신규
  메서드·파라미터 추가 위주)과 다른 영역이며 자동 병합 가능성이 높다.
- **Alternatives considered**: 엔티티 setter 내 가드(도메인 규칙 은닉, 기각) ·
  보호 미구현(현행 null-only 동작 의존 — 비우기 시나리오 무방비, 기각) ·
  admin 전용 테이블에 오버라이드 저장 후 조회 시 병합(읽기 경로 전면 수정 — 충돌
  회피 목적에 정면으로 반함, 기각).

## D3. 지표 산출 — kr_metrics.sql 정의를 admin 전용 리포지토리의 native query로 이식

- **Decision**: `AdminStatsRepository`(신규)에 Spring Data `@Query(nativeQuery = true)` +
  인터페이스 프로젝션으로 구현한다. 쿼리 정의(p95 = `percentile_cont(0.95)`, KR3 =
  `search_result_shown` distinct 세션 ÷ `visit` distinct 세션, 실패 분포, 매칭 성공률)는
  `backend/db/queries/kr_metrics.sql`의 정의를 **문자 그대로 이식**한다 — SC-006(기존 산출
  기준과 값 일치)의 근거. 가입·방문·검색 일별 추이는 `profiles.created_at`·`event_log`
  집계로 같은 리포지토리에 둔다.
- **Rationale**: `percentile_cont`는 JPQL로 표현 불가 → native 필수. Spring Data JPA의
  native query는 동일 EntityManager를 경유하므로 constitution의 "JPA 단일화"(별도
  드라이버·raw 커넥션 이중화 금지) 위반이 아니다. `EventLogRepository`는 002가 수정
  중이므로 건드리지 않고 같은 엔티티에 대한 별도 리포지토리를 신설(Spring Data는 엔티티당
  복수 리포지토리 허용).
- **Alternatives considered**: JdbcTemplate/JdbcClient(제2 접근 계층 — constitution 위반
  소지, 기각) · 애플리케이션 메모리 집계(event_log 전 행 로드 — 규모 증가 시 파탄, 기각) ·
  Supabase RPC/뷰(로직이 DB로 이탈해 코드 리뷰·형상관리 밖, 기각).

## D4. 데이터 접근 격리 — admin 쿼리는 admin 패키지 신규 파일에만

- **Decision**: 목록 검색·참조 카운트·활동 요약 등 admin 전용 쿼리는 전부
  `admin/repository/*`에 신설한다. 기존 리포지토리(ProfileRepository·ReviewRepository·
  CommentRepository·PlaylistRepository 등)는 **주입해서 기존 메서드만 재사용**하고
  (findById·delete 등 JpaRepository 기본 메서드), 메서드 추가 등 어떤 수정도 하지 않는다.
- **Rationale**: FR-012(기존 영역 무변경)의 기계적 보장. admin 요구로 공용 리포지토리가
  오염되는 것을 막고, 병행 트리와의 충돌면을 0으로 유지.
- **Alternatives considered**: 기존 리포지토리에 count 메서드 추가 — 파일은 002 미수정
  분이라 충돌 위험은 낮지만, admin 전용 관심사가 공용 코드에 스며들어 원칙 I(도메인
  경계) 저해. 기각.

## D5. 감사 기록 — 동일 트랜잭션 동기 기록

- **Decision**: `admin_audit_log` 테이블 + `AdminAuditLog` 엔티티 + `AdminAuditService`.
  모든 변경 작업(곡 수정·삭제, 리뷰·댓글 삭제, 플레이리스트 비공개 전환)은 해당 서비스
  트랜잭션 **안에서 동기적으로** 감사 행을 남긴다(변경과 기록의 원자성 → SC-004 누락 0건).
  기록 내용: 수행 관리자 UUID·작업 종류·대상 타입/ID·변경 전후 스냅샷(jsonb)·시각.
- **Rationale**: event_log(익명 계측, fire-and-forget)와 목적이 다르다 — 감사는 유실
  불가·책임 추적용이므로 비동기·무시 불가. 관리자 1인 트래픽에서 동기 기록 비용은 무의미.
- **Alternatives considered**: event_log에 event_type='admin_*'로 적재(계측과 감사의 역할
  혼합, 보존 정책 분리 불가 — backend-prd §7.2가 SearchHistory/event_log 분리를 명시한
  것과 같은 논리로 기각) · Hibernate Envers(전 엔티티 이력화 — 과잉, 기각).

## D6. DB 변경 — Supabase 마이그레이션 1건 + 수동 역할 지정

- **Decision**: 마이그레이션 `add_admin_audit_and_music_lock` 1건으로 ① `alter table music
  add column meta_locked boolean not null default false` ② `create table admin_audit_log`
  (+ `(created_at)` 인덱스). 관리자 지정은 앱 경로 없이 운영자가 SQL로 수행
  (`update profiles set role='ADMIN' where email='...'`) — FR-002, quickstart에 문서화.
- **Rationale**: 기존 관행(도메인 테이블도 Supabase 마이그레이션으로 관리)과 일치.
  신규 테이블·컬럼뿐이라 병행 트리와 스키마 충돌 없음(002는 스키마 무변경).
- **Alternatives considered**: 앱 내 역할 부여 API — 셀프 승격 경로가 생겨 FR-002 위반. 기각.

## D7. 모더레이션 의미론 — 기존 도메인 규칙과 동일하게

- **Decision**: ① 리뷰 삭제 = 행 삭제(1인 1리뷰 unique가 풀려 작성자는 재작성 가능 —
  spec US3-2). ② 댓글 삭제 = 작성자 삭제와 동일 의미론(`deleteByParentId` → 본문 삭제,
  기존 CommentRepository 메서드 재사용)으로 대댓글 동반 삭제. ③ 플레이리스트 조치 =
  `is_public=false` 전환만(삭제 없음 — 소유자 데이터 보존, spec US3-3). 모두
  `AdminModerationService`에서 리포지토리 직접 조작(기존 서비스의 소유자 검증을 우회하는
  admin 전용 경로).
- **Rationale**: 기존 사용자 삭제 경로(CommentService.delete)는 소유자 검증이 박혀 있어
  재사용 불가 — 서비스 시그니처 변경은 충돌면 확대라 리포지토리 수준 재사용이 맞다.
  의미론(대댓글 동반 삭제)만 동일하게 유지해 사용자 경험 일관성 확보.
- **Alternatives considered**: soft delete(숨김 플래그) — 전 조회 경로에 필터 추가 필요
  (기존 파일 대량 수정), 현 규모에 과잉. 기각.

## D8. 곡 삭제 차단 — 참조 카운트 선검사 + 409

- **Decision**: 삭제 전 `AdminMusicRepository`가 favorite·playlist_music·search_history
  (top_music_id)의 참조 수를 집계, 하나라도 있으면 기존 `ConflictException`(409 표준
  바디)으로 차단하고 메시지에 참조 현황(예: "즐겨찾기 2·플레이리스트 1·검색기록 5")을
  담는다. 상세 조회(GET /api/admin/music/{id})에도 같은 카운트를 노출해 관리자가 삭제
  가능 여부를 미리 안다.
- **Rationale**: FK 제약 위반 예외를 사후 해석하는 것보다 선검사가 메시지 품질·테스트
  용이성 모두 우위. ConflictException은 기존 핸들러가 처리 — 신규 예외 타입 불필요
  (GlobalExceptionHandler 무수정 유지).
- **Alternatives considered**: cascade 삭제(사용자 저장물 파괴 — spec FR-010의 "소유자
  데이터에 영향 금지" 위반, 기각) · 참조를 null로 끊고 삭제(검색 기록 스냅샷 훼손, 기각).

## D9. 계약·문서 동기화 — contracts가 정본, 실행 PRD는 병합 순서 관리

- **Decision**: `specs/003-admin-page-backend/contracts/admin-api.md`를 프론트 트리가
  소비하는 **계약 정본**으로 삼는다. `docs/prd/backend-prd.md` §6.2·`docs/prd/frontend-prd.md` §8
  갱신은 구현 완료 후 PR 마무리 태스크로 두되, 두 문서 모두 spec 002가 수정 중이므로
  **spec 002 병합 → 본 브랜치 rebase → 문서 갱신 커밋** 순서로 진행한다.
- **Rationale**: 원칙 II의 취지(계약 불일치 조기 발견)는 contracts 선확정으로 충족하면서,
  문서 충돌(같은 표에 행 추가)은 순서 제어로 회피. 어드민 계약은 관리자 1인용이라
  사용자향 계약 대비 동기화 리스크 자체가 낮다.
- **Alternatives considered**: 지금 즉시 PRD 수정(002와 같은 표를 양쪽에서 수정 — 확실한
  충돌, 기각) · PRD 갱신 생략(원칙 II 위반, 기각).

## D10. 검증 전략 — 단위 테스트 + 수동 E2E(quickstart)

- **Decision**: ① Mockito 단위 테스트: 인터셉터(역할별 허용/거부), AdminMusicService
  (정정→잠금 세팅, 참조 시 삭제 차단, 감사 기록 호출), AdminModerationService(삭제
  의미론), MusicService 가드(잠긴 곡 fillMissing 미적용). ② 지표 native query는 단위
  테스트로 검증 불가(H2 없음·PostgreSQL 함수 의존) → quickstart의 실 Supabase 대조
  시나리오(SC-006: kr_metrics.sql 수동 실행 값과 API 응답 일치)로 검증. ③ 게이트:
  `./gradlew build`(기존 테스트 전체 포함) — 외부 API가 없어 mock 프로파일 불요(원칙 VI).
- **Rationale**: 기존 테스트 관행(서비스 단위 테스트 + mock E2E)과 정합. 어드민은
  ACRCloud류 외부 의존이 없어 CI 게이트가 단순해진다.
- **Alternatives considered**: Testcontainers PostgreSQL 도입 — native query 자동 검증은
  얻지만 신규 인프라 의존·CI 시간 증가. 현 규모에서 quickstart 대조로 충분, 후속 검토.
