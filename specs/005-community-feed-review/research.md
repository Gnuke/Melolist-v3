# Phase 0 Research: 커뮤니티 — 공개 탐색 피드·서비스 리뷰·댓글

**Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

기술 스택은 constitution으로 확정되어 있어(변경 불가) 연구 대상은 "기존 자산 위에서
무엇을 재사용하고 무엇을 새로 만드는가"다. 코드·운영 DB 실사 결과를 결정으로 정리한다.

## R1. 기존 백엔드 재사용 범위 — 핵심 발견

**Decision**: community 도메인은 **M2 스캐폴드에서 이미 대부분 구현되어 있다**.
신규 테이블 0, 마이그레이션 0으로 진행하고, 아래 갭만 메운다.

실사 결과 (2026-08-12, `backend/src/main/java/com/melolist/community/` + 운영 DB):

| 자산 | 상태 | 비고 |
|---|---|---|
| `GET /api/reviews` (페이지, 게스트) | ✅ 구현됨 | createdAt desc, size cap 50 |
| `GET /api/reviews/me`·`/{id}` | ✅ 구현됨 | /me 없으면 404 |
| `POST /api/reviews` (1인 1건) | ✅ 구현됨 | exists 선검사 + unique 제약 경합 시 409 (동시 제출 커버) |
| `PATCH·DELETE /api/reviews/{id}` | ✅ 구현됨 | 본인 아니면 403 |
| `GET·POST /api/playlists/{id}/comments` | ✅ 구현됨 | `assertViewable`로 공개/소유 검증 — 비공개 전환 시 작성 거부 충족 |
| `DELETE /api/comments/{id}` | ✅ 구현됨 | 본인 아니면 403, 대댓글 연쇄 삭제 |
| `GET /api/community/playlists` (공개 피드) | ✅ 구현됨 | updatedAt desc + trackCount |
| DB `review`·`comment` 테이블 | ✅ 운영 존재 | 07-10 `create_domain_tables`로 생성, 현재 0행 |
| `profiles.review_hide_until` | ✅ 컬럼·엔티티 존재 | 갱신 API가 없음 |
| ReviewService 단위 테스트 | ✅ 존재 | PR #32 백필 |
| **리뷰·댓글 길이 상한** | ❌ 갭 | DTO에 `@Size` 없음 (`@NotBlank`만) |
| **PATCH /users/me/review-visibility** | ❌ 갭 | 유예 저장 API 미구현 (PRD 예정분) |
| **리뷰 유도 판정 API** | ❌ 갭 | 검색 3회·유예·기작성 판정 없음 |
| **피드 작성자 요약** | ❌ 갭 | `PlaylistResponse`에 ownerId만 있고 닉네임·아바타 없음 (FR-002) |
| CommentService 단위 테스트 | ❌ 갭 | #32 백필 범위 밖이었음 |
| **프론트엔드 전체** | ❌ 갭 | 커뮤니티 화면·리뷰 UI·댓글 UI·유도 모달 전부 신규 |

**Rationale**: 기능의 실질 작업량은 프론트가 지배한다. 백엔드는 갭 5건의 소규모 수정.

## R2. 리뷰·댓글 길이 상한 검증 위치

**Decision**: DTO Bean Validation으로 강제 — `ReviewDtos.CreateRequest/UpdateRequest.content`
에 `@Size(max = 500)`, `CommentDtos.CreateRequest.content`에 `@Size(max = 300)`.
프론트는 입력 컴포넌트 `maxLength` + 남은 글자 수 표시로 선제 차단.

**Rationale**: 검증 실패는 기존 GlobalExceptionHandler의 표준 바디(`{code, message,
details}`)로 떨어져 F4 원칙(정제 카피) 충족. DB 컬럼은 text라 스키마 변경 불필요.

**Alternatives considered**: DB CHECK 제약 — 마이그레이션이 필요하고 오류가 500으로
새서 기각. 서비스 계층 수동 검증 — Bean Validation 관례(기존 rating @Min/@Max)와 이중화라 기각.

## R3. 대댓글(parent_id) 처리 — 스펙(단일 깊이)과 기존 코드의 간극

**Decision**: 서버의 1단 대댓글 능력(`parent_id` 수용·검증·연쇄 삭제)은 **그대로
두고**, 프론트가 `parent_id`를 보내지 않고 답글 UI를 노출하지 않는 것으로 스펙의
"v1 단일 깊이"를 충족한다. 계약 문서에는 `parent_id`를 "예약(v1 프론트 미사용)"으로
명기한다.

**Rationale**: 동작 요구(FR-006)는 UI 기준으로 충족되고, 검증된 기존 코드를 걷어내는
편이 오히려 회귀 리스크다. 이후 마일스톤에서 대댓글을 열 때 서버 변경이 0이 된다.

**Alternatives considered**: parent_id 요청 거부(400) — 기존 코드 수정+테스트 수정
비용 대비 이득 없음. 서버 코드 삭제 — 연쇄 삭제 로직까지 걷어야 해 기각.

## R4. 공개 피드의 작성자 요약 — 응답 확장 방식

**Decision**: 커뮤니티 전용 응답 `CommunityPlaylistResponse`(기존 `PlaylistResponse`
필드 + `author {id, display_name, avatar_url}` — 기존 `AuthorSummary` 재사용)를
community 도메인에 신설한다. 작성자 프로필은 **페이지 단위 일괄 조회**(ownerId 수집
→ `findAllById`)로 채워 N+1을 방지한다 — 기록 화면의 top 곡 일괄 조인과 같은 패턴.

**Rationale**: `PlaylistResponse`는 내 플레이리스트 화면 등 소유자 맥락에서 쓰여
작성자 표시가 불필요하다. 공용 DTO를 건드리면 영향 범위가 커진다(원칙 I — 영향 최소화).

**Alternatives considered**: `PlaylistResponse`에 author 추가 — 전 화면 계약 변경이라
기각. 프론트에서 개별 프로필 조회 — N+1 왕복이라 기각.

## R5. 리뷰 유도 판정 — 서버 권위 vs 클라이언트 카운트

**Decision**: 서버 권위 판정. 신규 `GET /api/reviews/prompt`(로그인 전용) →
`{eligible: boolean}`. 판정식: **리뷰 미작성** AND **유예 아님**(`review_hide_until`
null 또는 과거) AND **누적 검색 ≥ 3회**(`search_history`의 `countByUserId` — 신규
쿼리 메서드 1개). 프론트는 로그인 사용자의 검색 완료 화면 진입 시 1회 조회하고,
`eligible=true`면 유도 시트를 띄운다.

**Rationale**: FR-010의 "어느 기기에서도" 요구는 서버 상태여야만 충족된다. 검색
횟수 원천으로 `search_history`를 쓰는 이유: 로그인 사용자의 검색마다 서버가 직접
기록하는 1차 데이터라 유실이 없다. `event_log`는 클라 발화 계측이라 유실 가능성이
있고(과거 keepalive 이슈), 세션 기준이라 부적합.

**Alternatives considered**: `GET /users/me` 응답 확장 — useMe 캐시(staleTime 5분,
localStorage 사본)에 세션 중 변하는 값이 섞여 부적합. 클라 localStorage 카운트 —
기기 간 불일치로 기각.

## R6. 유예 저장 API

**Decision**: `PATCH /api/users/me/review-visibility` `{action: "later"}` →
`review_hide_until = now + 7일`. 유예 일수는 설정값(`melolist.review.prompt-defer-days`,
기본 7)으로 두고 204를 반환한다. 경로는 backend-prd §6.2에 M4 예정분으로 이미 잡혀
있는 것을 그대로 사용한다.

**Rationale**: PRD 예정 계약과 일치(원칙 II — 계약 정본). 액션 enum으로 두면 이후
"다시 보지 않기" 등 확장이 무마이그레이션으로 가능하다.

**Alternatives considered**: 기존 `PATCH /users/me`에 필드 추가 — 프로필 수정(별명·
아바타)과 의미가 섞여 기각.

## R7. 신규 이벤트 사전 (원칙 III — 같은 마일스톤 내 계측)

**Decision**: 클라 발화 5종을 event_log 사전에 추가한다(양 PRD 동시 갱신 — 원칙 II).

| 이벤트 | payload | 발화 시점 |
|---|---|---|
| `community_view` | `{segment: "playlists"\|"reviews"}` | 커뮤니티 화면 진입·세그먼트 전환 |
| `review_prompt_shown` | `{}` | 유도 시트 노출 |
| `review_prompt_later` | `{}` | "나중에" 선택 |
| `review_submit` | `{rating, is_edit}` | 리뷰 작성·수정 확정 |
| `comment_submit` | `{playlist_id}` | 댓글 작성 확정 |

**Rationale**: SC-004(리뷰 작성률·커뮤니티 조회 규모)와 SC-005(유예 재노출 0건)를
SQL로 산출 가능하게 하는 최소 집합. 조회는 화면 단위(`community_view`)로 충분하고
피드 스크롤 심도 계측은 베타 규모(10~20명)에서 과하다.

## R8. 타인 자원 변경 거부 방식 — 403 유지

**Decision**: 리뷰·댓글의 비소유 변경 시도는 기존 구현대로 **403**으로 거부한다.
spec FR-005의 "존재 비노출" 문구는 이 결정에 맞춰 정정한다(plan 단계에서 반영).

**Rationale**: 존재 비노출(404) 패턴은 비공개 자원(검색 기록 등)의 프라이버시
보호책이다. 리뷰·댓글은 피드에 공개된 자원이라 404로 위장해도 숨겨지는 정보가 없고,
기존 코드·테스트가 403으로 검증되어 있다.

## R9. XSS 방어 — 플레인 텍스트 렌더

**Decision**: 서버는 원문 저장(이스케이프·새니타이즈 없음), 프론트는 React 기본
텍스트 렌더만 사용한다. 리뷰·댓글 표시 경로에 `dangerouslySetInnerHTML` 사용을
금지한다(리뷰 대상 코드 규칙). 줄바꿈은 CSS `whitespace-pre-wrap`으로 처리한다.

**Rationale**: React의 기본 이스케이프가 v2 `v-html` 사고의 구조적 재발 방지책이다.
서버 이스케이프는 이중 인코딩 문제를 만들어 기각(Comment 엔티티 주석의 기존 방침과 일치).

## R10. 정렬·페이지 규격 — 기존 관례 승계

**Decision**: 공개 플레이리스트 피드 `updated_at desc`(기존), 리뷰 피드 `created_at
desc`(기존), 페이지 크기 기본 20·상한 50(기존), 응답은 `PageResponse`(snake_case).
댓글 목록은 비페이지 List·`created_at asc`(기존) 유지. 프론트 피드는 기존 목록
화면과 같은 페이지 방식(TanStack Query)으로 소비한다.

**Rationale**: 스펙 "최신순"과 기존 구현이 일치한다. 댓글은 플레이리스트당 규모가
작아(베타 코호트 10~20명) 페이지네이션이 과하다.
