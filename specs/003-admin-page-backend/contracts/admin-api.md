# API Contract: 관리자 어드민 (`/api/admin/**`)

**Date**: 2026-07-22 (계약 동기화 v2) · **Status**: 정본 위임

> **정본은 프론트 트리의 계약 문서다**: `specs/003-admin-page-front/contracts/admin-api.md`
> (adminpage-front 워크트리). §0 공통 규약·§1 지표(`?days=`)·§2 곡 목록(`missing` 필터)·
> §3 곡 부분 수정·§4 사용자 목록·§5 역할 변경은 그 문서를 따르며, 백엔드 구현은
> 2026-07-22 동기화로 전부 일치시켰다. 변경이 필요하면 프론트 정본을 먼저 고친다.

## 백엔드 구현 노트 (정본 계약의 구현 방식)

- **인가**: `AdminAuthInterceptor`(`/api/admin/**` 전용) — `profiles.role` DB 판정.
  무토큰 401(기존 SecurityFilterChain), 비관리자 403. SecurityConfig 무수정(research D1).
- **에러 코드**: 프론트 계약의 `INVALID_ARGUMENT`(400 + `details.field`)·
  `SELF_DEMOTION_FORBIDDEN`(409)은 admin 패키지 전용
  `@RestControllerAdvice(basePackages="com.melolist.admin")`가 매핑한다 —
  GlobalExceptionHandler 무수정(FR-012). 선언 밖 예외(403·404·409 CONFLICT 등)는 기존
  공통 코드 그대로.
- **지표 정의**: `backend/db/queries/kr_metrics.sql` 정본 이식(SC-006). 기간은 롤링
  윈도(now − days). `weekly`는 기간 무관 전체.
- **역할 변경**(정본 §5): ADMIN 전용 + 자기 자신 ADMIN 해제 409 + 같은 역할 재지정은
  멱등(감사 생략). 감사 action `ROLE_CHANGE`. 최초 관리자는 DB 수동 지정(FR-002).

## 백엔드 전용 보충 API (프론트 정본에 없음 — 현재 화면 미사용)

### GET `/api/admin/music/{id}`

```jsonc
// 200 — 곡 상세 + 참조 카운트(삭제 가능 여부 판단, research D8)
{ "music": { /* MusicAdminItem (정본 §2와 동일 + meta_locked) */ },
  "references": { "favorite_count": 2, "playlist_item_count": 1, "history_count": 5 } }
// 404
```

### DELETE `/api/admin/music/{id}`

```jsonc
// 204 (+ audit MUSIC_DELETE)
// 409 CONFLICT: 참조 존재 — message에 참조 현황("즐겨찾기 N·플레이리스트 N·검색기록 N")
// 404
```

### GET `/api/admin/users?query=`

정본 §4에 더해 `query`(이메일·닉네임 부분일치) 파라미터를 추가 지원한다.

### GET `/api/admin/users/{id}`

```jsonc
// 200 — 프로필 + 활동 요약(집계 수치만 — FR-013 개인정보 경계)
{ "id": "uuid", "email": "…", "display_name": "…", "avatar_url": "…", "role": "USER",
  "created_at": "…",
  "activity": { "search_count": 12, "favorite_count": 5, "playlist_count": 2, "has_review": true } }
```

### 모더레이션 (spec US3 원안 — 후속 화면용)

- `GET /api/admin/reviews` — 작성자(email 포함) 리뷰 목록, PageResponse
- `DELETE /api/admin/reviews/{id}` — 204 (+ audit REVIEW_DELETE), 작성자는 재작성 가능
- `DELETE /api/admin/comments/{id}` — 204, 대댓글 동반 삭제 (+ audit COMMENT_DELETE)
- `POST /api/admin/playlists/{id}/unpublish` — 204 멱등 (+ audit PLAYLIST_UNPUBLISH)

## 백엔드 추가 필드·동작 (정본과 호환되는 확장)

- **`meta_locked`** (MusicAdminItem 추가 필드): 관리자 PATCH 성공 시 true — 이후 검색
  파이프라인 자동 보강(fillMissing)이 이 곡을 덮어쓰지 않는다(FR-007). 정본 §3의
  last-write-wins는 "관리자 저장 간 경합"에 대한 규칙이고, **자동 보강 대 관리자 정정**은
  잠금이 우선한다. 프론트는 이 필드를 무시해도 무방.
- 감사 기록(`admin_audit_log`): 모든 변경 작업(MUSIC_UPDATE/MUSIC_DELETE/REVIEW_DELETE/
  COMMENT_DELETE/PLAYLIST_UNPUBLISH/ROLE_CHANGE)이 변경과 같은 트랜잭션으로 남는다(FR-011).
