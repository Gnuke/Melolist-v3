# API 계약 정본: 커뮤니티 — 공개 탐색 피드·서비스 리뷰·댓글

**Date**: 2026-08-12 | **Plan**: [../plan.md](../plan.md)

> 프론트가 소비하는 계약의 정본. 병합 PR에서 backend-prd §6.1/§6.2·frontend-prd §8에
> 동일 내용을 반영해야 한다(constitution 원칙 II). 별도 표기 없으면 응답은
> **snake_case**·오류는 표준 바디 `{code, message, details}`·페이지 응답은
> `PageResponse {items, page, size, total_items, total_pages}`.

## 공통 타입

```jsonc
// AuthorSummary — 리뷰·댓글·피드 작성자 요약 (기존 DTO 재사용)
{ "id": "uuid", "display_name": "string|null", "avatar_url": "string|null" }
```

## 1. 커뮤니티 공개 플레이리스트 피드

### `GET /api/community/playlists?page=0&size=20` — 게스트 허용

- 정렬 `updated_at desc`, size 상한 50. **기존 엔드포인트의 응답 확장**(작성자 요약 추가).

```jsonc
// 200 — PageResponse<CommunityPlaylistItem>
{
  "items": [{
    "id": 1, "owner_id": "uuid", "title": "출근길 발견", "description": "string|null",
    "is_public": true, "cover_url": "string|null", "track_count": 12,
    "created_at": "...", "updated_at": "...",
    "author": { "id": "uuid", "display_name": "멜로", "avatar_url": null }   // ← 신규
  }],
  "page": 0, "size": 20, "total_items": 1, "total_pages": 1
}
```

- 항목 탭 → 기존 `/playlists/:id` 상세(공개 조회 경로 재사용, 비공개 전환 시 404).

## 2. 서비스 리뷰

```jsonc
// Review
{ "id": 1, "author": AuthorSummary, "rating": 5, "content": "string(≤500)",
  "created_at": "...", "updated_at": "..." }
```

### `GET /api/reviews?page=0&size=20` — 게스트 허용 (기존)

`PageResponse<Review>`, 정렬 `created_at desc`, size 상한 50.

### `GET /api/reviews/me` — 인증 (기존)

`200 Review` / `404` 작성한 리뷰 없음 — 클라이언트는 404를 "작성 가능"으로 해석(오류 토스트 금지).

### `POST /api/reviews` — 인증 (기존 + content @Size(500) 추가)

요청 `{ "rating": 1..5(정수, 필수), "content": "≤500자, 공백만 불가" }`

- `201 Review`
- `409` 이미 작성(1인 1건, 동시 제출 포함) — **클라이언트는 기존 리뷰 수정 흐름으로 유도**(FR-004)
- `400` 검증 실패(별점 범위·길이) — 정제 카피로 표시

### `PATCH /api/reviews/{id}` — 인증·작성자 본인 (기존)

요청 `{ "rating"?: 1..5, "content"?: "≤500자" }` (null 필드는 미변경) → `200 Review` / `403` 비소유 / `404`

### `DELETE /api/reviews/{id}` — 인증·작성자 본인 (기존)

`204` / `403` / `404`. 삭제 후 재작성 가능.

### `GET /api/reviews/prompt` — 인증 **(신설, R5)**

리뷰 유도 노출 자격의 서버 권위 판정. 판정식: 리뷰 미작성 AND `review_hide_until`
null/과거 AND 누적 검색 ≥ 3회(설정 `prompt-search-threshold`).

```jsonc
// 200
{ "eligible": true }
```

- 호출 시점: 로그인 사용자의 검색 결과 표시 시 1회(fire-and-check). 게스트는 호출하지 않음.
- 백엔드 구현 주의: `/{id}` 매핑보다 먼저 선언(기존 `/me`와 동일 함정).

## 3. 리뷰 유도 유예

### `PATCH /api/users/me/review-visibility` — 인증 **(신설, R6 — PRD §6.2 예정 경로)**

요청 `{ "action": "later" }` → `204`. `review_hide_until = now + 7일`(설정
`prompt-defer-days`). 알 수 없는 action은 `400`.

## 4. 공개 플레이리스트 댓글

```jsonc
// Comment — parent_id는 v1 예약(항상 null 전송·UI 미노출, R3)
{ "id": 1, "playlist_id": 1, "parent_id": null, "author": AuthorSummary,
  "content": "string(≤300)", "created_at": "...", "updated_at": "..." }
```

### `GET /api/playlists/{playlistId}/comments` — 게스트 허용(공개 항목) (기존)

`200 [Comment]` — 비페이지, `created_at asc`. 비공개·없음 `404`(존재 비노출).

### `POST /api/playlists/{playlistId}/comments` — 인증 (기존 + content @Size(300) 추가)

요청 `{ "content": "≤300자, 공백만 불가" }` → `201 Comment` / `404` 비공개
전환·삭제됨(엣지 케이스 카피: "더 이상 공개된 플레이리스트가 아니에요") / `400` 길이.

### `DELETE /api/comments/{id}` — 인증·작성자 본인 (기존)

`204` / `403` / `404`

## 5. 이벤트 사전 추가 (`POST /api/events` — 기존 수집기, 타입 5종 추가)

| type | properties | 발화 시점 |
|---|---|---|
| `community_view` | `{segment: "playlists"\|"reviews"}` | 커뮤니티 화면 진입·세그먼트 전환 |
| `review_prompt_shown` | `{}` | 유도 시트 노출 |
| `review_prompt_later` | `{}` | "나중에" 선택(서버 유예 저장과 별개 계측) |
| `review_submit` | `{rating: number, is_edit: boolean}` | 리뷰 작성·수정 확정 성공 시 |
| `comment_submit` | `{playlist_id: number}` | 댓글 작성 확정 성공 시 |

프론트 `features/events/track.ts`의 `EventType` 유니온에 5종 추가(서버는 자유 문자열).

## 6. 오류 코드·클라이언트 동작 요약

| 상황 | 응답 | 클라이언트 |
|---|---|---|
| 리뷰 중복 작성 | `409` | "이미 작성한 리뷰가 있어요" + 수정 시트 전환 |
| 게스트가 작성 시도 | (호출 전 차단) | GuestPrompt 패턴 — `/login?state.next`로 유도 후 맥락 복귀 |
| 검증 실패(길이·별점) | `400` | 입력 하단 정제 카피(입력은 `maxLength`로 선제 차단) |
| 비소유 수정·삭제 | `403` | UI에 진입점 미노출이 1차 방어 — 발생 시 일반 오류 카피 |
| 비공개 전환된 대상 | `404` | 피드 갱신 + 안내 카피, `message` 직접 렌더 금지(F4) |

## 7. 케이싱·렌더 주의

- 본 계약 전 구간 snake_case. **`/users/me` 계열만 camelCase**(기존 관례) — 3번
  유예 API는 204 무본문이라 영향 없음.
- 리뷰·댓글 `content`는 서버 원문 저장 — 렌더는 React 텍스트 노드만, 줄바꿈은
  `whitespace-pre-wrap`, `dangerouslySetInnerHTML` 금지(R9, SC-003).
