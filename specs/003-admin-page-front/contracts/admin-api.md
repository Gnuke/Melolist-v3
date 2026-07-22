# Admin API Contract — v1

**Status**: 확정(프론트 기준 계약) · **Date**: 2026-07-22
**Consumers**: 프론트(`feat/adminpage-front` 트리) · **Providers**: 백엔드(별도 어드민 백 트리)

> 이 문서가 어드민 프론트·백 간의 **유일한 계약 정본**이다(스펙 Assumption — 실행 PRD
> §6.1↔§8 동기화는 양쪽 병합 후 별도 문서 PR 1회로 수행). 변경이 필요하면 이 파일을
> 먼저 고치고 양쪽이 따른다. 프론트 mock(`frontend/src/mock/adminMock.ts`)의 데이터는
> 본 문서의 예시 응답과 동일하게 유지한다.

## 0. 공통 규약

- **Base**: `/api/admin/*` · 인증 필수: `Authorization: Bearer <supabase-jwt>`
- **인가**: 전 엔드포인트 관리자 전용 — `profiles.role = 'ADMIN'` (앱 계층 인가,
  constitution 원칙 I). 미인증 **401**, 비관리자 **403**. 권한 상실은 다음 요청부터
  403(스펙 엣지 케이스).
- **에러 바디**: 표준 `{ "code", "message", "details" }` — raw 예외 노출 금지.
- **표기**: 응답·요청 필드는 **snake_case** (M2 이후 목록 계약 관례. PageResponse:
  `items / page / size / total_items / total_pages`).
- **개인정보 경계**: 어드민 API는 개별 사용자의 검색 기록·즐겨찾기·플레이리스트 내용을
  반환하지 않는다(FR-011). 지표는 집계 수치만.
- 기존 `GET /api/users/me` 응답의 `role` 필드(이미 존재, camelCase 유지)를 프론트
  가드가 사용한다 — **본 계약에서 변경 없음**.

## 1. `GET /api/admin/metrics?days={N}` — 대시보드 지표 (US1)

- `days`: 조회 기간(일). 기본 14, 허용 1~90. `weekly`는 기간과 무관하게 전체 주간을
  반환한다(추이 목적).
- 산출 정의는 `backend/db/queries/kr_metrics.sql`을 **정본**으로 따른다
  (no_match도 KR2 모수 포함, visit은 세션당 1회 전제, `mode = null` 행 = 전체 롤업).

```jsonc
// 200
{
  "period_days": 14,
  "kr2": {
    "target_ms": 6000,
    "rows": [
      // mode: "fingerprint" | "humming" | null(전체 롤업)
      { "mode": "fingerprint", "n": 42, "matched_n": 38, "p50_ms": 2100, "p95_ms": 4800, "max_ms": 7200, "pass": true },
      { "mode": "humming",     "n": 17, "matched_n": 11, "p50_ms": 3900, "p95_ms": 5708, "max_ms": 9100, "pass": true },
      { "mode": null,          "n": 59, "matched_n": 49, "p50_ms": 2500, "p95_ms": 5400, "max_ms": 9100, "pass": true }
    ]
  },
  "kr2_breakdown": [
    // upsert_p95_ms는 비동기 측정치(응답 경로 밖) — 화면에 그 주석 필요
    { "mode": "fingerprint", "n": 42, "acr_p95_ms": 1500, "meta_p95_ms": 3600, "upsert_p95_ms": 900, "total_p95_ms": 4800 },
    { "mode": "humming",     "n": 17, "acr_p95_ms": 2100, "meta_p95_ms": 3900, "upsert_p95_ms": 2500, "total_p95_ms": 5708 },
    { "mode": null,          "n": 59, "acr_p95_ms": 1700, "meta_p95_ms": 3700, "upsert_p95_ms": 1100, "total_p95_ms": 5400 }
  ],
  "kr3": {
    "target_pct": 70,
    "visit_sessions": 31,
    "completed_sessions": 12,
    "completion_pct": 38.7,   // visit_sessions = 0 이면 null (분모 0 — 프론트 "데이터 없음")
    "pass": false             // completion_pct 가 null 이면 false
  },
  "failures": [
    { "mode": "humming", "reason": "no_match", "n": 6 },
    { "mode": "fingerprint", "reason": "timeout", "n": 2 }
  ],
  "weekly": [
    // 최신 주 먼저. mode 별 행(전체 롤업 없음)
    { "week": "2026-07-20", "mode": "fingerprint", "n": 12, "p95_ms": 4600 },
    { "week": "2026-07-13", "mode": "humming", "n": 10, "p95_ms": 5708 }
  ],
  "totals": {
    "search_count": 59,      // 기간 내 search_request 수
    "matched_count": 49,     // 기간 내 matched=true 수
    "user_count": 8,         // 누적 profiles 수
    "music_count": 133       // 누적 music 캐시 수
  }
}
// 400: days 범위 밖 → { "code": "INVALID_ARGUMENT", ... }
```

- 데이터가 전혀 없는 기간: `kr2.rows`·`kr2_breakdown`·`failures`·`weekly`는 빈 배열,
  `kr3.completion_pct`는 `null` — 오류가 아니다(스펙 엣지 케이스).

## 2. `GET /api/admin/music` — 곡 카탈로그 목록 (US2)

Query: `query`(선택, 제목·아티스트 부분 일치) · `missing`(선택: `video` = 영상 식별자
없음 | `cover` = 커버 없음) · `page`(기본 0) · `size`(기본 20, 최대 100).
정렬: `created_at` 내림차순 고정.

```jsonc
// 200 — PageResponse<MusicAdminItem>
{
  "items": [
    {
      "id": 133,
      "acrid": "9a8b…",              // null 가능
      "title": "좋은 날",
      "artist": "아이유",             // null 가능
      "album": "Real",               // null 가능
      "release_date": "2010-12-09",  // null 가능
      "youtube_video_id": "jeqdYqsrsA0", // null 가능
      "cover_url": "https://…/300x300bb.jpg", // null 가능
      "duration_ms": 233000,         // null 가능
      "source": "ACRCLOUD",
      "created_at": "2026-07-16T09:12:00Z",
      "updated_at": "2026-07-16T09:12:00Z"
    }
  ],
  "page": 0, "size": 20, "total_items": 133, "total_pages": 7
}
```

## 3. `PATCH /api/admin/music/{id}` — 곡 메타 수정 (US2)

담긴 필드만 수정한다(부분 수정 — 기존 PATCH /users/me 관례). 빈 문자열은 null로
정규화한다(값 비우기).

```jsonc
// 요청 — 전 필드 선택
{
  "title": "좋은 날",              // 담긴 경우 공백만일 수 없음, ≤255자
  "artist": "아이유",              // ≤255자
  "album": "Real",                // ≤255자
  "release_date": "2010-12-09",   // ISO date
  "youtube_video_id": "jeqdYqsrsA0", // ^[A-Za-z0-9_-]{11}$ (ytimg 폴백 체인의 전제 형식)
  "cover_url": "https://…"        // http(s) URL 문자열만 — 업로드·재호스팅 없음(원칙 IV)
}
// 200: 수정 반영된 MusicAdminItem (§2와 동일 형태 — 저장 후 최신 상태 재표시용)
// 400: 형식 위반 → { "code": "INVALID_ARGUMENT", "details": { "field": "youtube_video_id" } }
// 404: 없는 id
```

- 동시 갱신(검색 파이프라인 upsert 경합)은 마지막 저장 승리(last-write-wins) —
  응답이 항상 저장 후 최신 상태이므로 프론트는 응답으로 화면을 갱신한다.

## 4. `GET /api/admin/users` — 사용자 목록 (US3)

Query: `page`(기본 0) · `size`(기본 20, 최대 100). 정렬: `created_at` 내림차순 고정.

```jsonc
// 200 — PageResponse<UserAdminItem>
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000", // uuid
      "email": "user@example.com",
      "display_name": "홍길동",    // null 가능
      "avatar_url": "https://…",  // null 가능
      "role": "USER",             // "USER" | "ADMIN"
      "created_at": "2026-07-14T02:00:00Z"
    }
  ],
  "page": 0, "size": 20, "total_items": 8, "total_pages": 1
}
```

## 5. `PATCH /api/admin/users/{id}/role` — 역할 변경 (US3)

```jsonc
// 요청
{ "role": "ADMIN" }   // "ADMIN" | "USER" 만 허용
// 200: 갱신된 UserAdminItem (§4와 동일 형태)
// 400: 허용 외 값 → INVALID_ARGUMENT
// 404: 없는 id
// 409: 자기 자신의 ADMIN 해제 시도 → { "code": "SELF_DEMOTION_FORBIDDEN", ... } (FR-008)
```

## 6. 백엔드 구현 노트 (참고 — 계약은 아님)

- SecurityFilterChain: `/api/admin/**`는 인증 필수 목록에 추가(화이트리스트 방식 유지,
  backend-prd §9-6). 인가는 `@PreAuthorize` + profiles.role 조회(앱 계층 단독 — 부록 A-2).
- 집계는 kr_metrics.sql의 정의를 JPA/native query로 이식 — 산식 변경 시 SQL 파일과
  본 계약 예시를 함께 갱신할 것.
- `weekly`의 `week`는 `date_trunc('week', …)::date` 문자열(YYYY-MM-DD).
- 이벤트 오염 방지는 프론트 책임(FR-012 — 어드민 영역 이벤트 미발화)이므로 백엔드
  필터링 불필요.
