# Data Model: 관리자 어드민 페이지 — 프론트엔드

**Date**: 2026-07-22 · **Spec**: [spec.md](./spec.md) · **Contract**: [contracts/admin-api.md](./contracts/admin-api.md)

프론트가 소비·표시하는 뷰 모델을 정의한다. 서버 저장 스키마는 기존 테이블
(`event_log`·`music`·`profiles`)을 그대로 사용하며 **본 기능은 신규 테이블·컬럼을
만들지 않는다**(스펙 Assumption — 어드민 백 트리도 동일 전제).

## 1. AdminMetrics (읽기 전용 — US1)

`GET /api/admin/metrics` 응답 전체. TypeScript 타입은 `features/admin/types.ts`에
계약과 1:1로 정의한다.

| 필드 | 타입 | 비고 |
|---|---|---|
| period_days | number | 조회 기간(1~90, 기본 14) |
| kr2.target_ms | number | 6000 고정(서버 제공 — 프론트 하드코딩 금지) |
| kr2.rows[] | Kr2Row | mode(`fingerprint`\|`humming`\|null=전체), n, matched_n, p50_ms, p95_ms, max_ms, pass |
| kr2_breakdown[] | Kr2Breakdown | mode, n, acr_p95_ms, meta_p95_ms, upsert_p95_ms(비동기 측정 주석 필요), total_p95_ms |
| kr3 | Kr3 | target_pct(70), visit_sessions, completed_sessions, completion_pct(**null=분모 0**), pass |
| failures[] | FailureRow | mode, reason(`bad_audio`\|`no_match`\|`low_score`\|`error`\|`timeout`\|`cancelled`), n |
| weekly[] | WeeklyRow | week(YYYY-MM-DD), mode, n, p95_ms — 최신 주 먼저 |
| totals | Totals | search_count·matched_count(기간 내), user_count·music_count(누적) |

**표시 규칙**:
- `completion_pct === null` → "데이터 없음" 상태(오류 아님 — 스펙 엣지 케이스).
- 빈 배열(`rows`/`failures`/`weekly`) → 각 섹션 빈 상태 표시.
- pass/fail은 서버 값 사용(프론트 재판정 금지 — 산식 정본 원칙).

## 2. MusicAdminItem (읽기 + 부분 수정 — US2)

| 필드 | 타입 | 수정 | 검증(수정 시) |
|---|---|---|---|
| id | number | ✕ | |
| acrid | string \| null | ✕ | upsert 키 — 어드민 수정 불가 |
| title | string | ○ | 담긴 경우 공백 불가, ≤255자 |
| artist | string \| null | ○ | ≤255자 |
| album | string \| null | ○ | ≤255자 |
| release_date | string(ISO date) \| null | ○ | 유효 날짜 |
| youtube_video_id | string \| null | ○ | `^[A-Za-z0-9_-]{11}$` |
| cover_url | string \| null | ○ | http(s) URL 문자열만(원칙 IV — 업로드 없음) |
| duration_ms | number \| null | ✕ | |
| source | string | ✕ | |
| created_at / updated_at | string(ISO) | ✕ | |

**상태 전이**: 수정 폼 제출 → 클라 검증(위 규칙 선차단) → PATCH → 200 응답으로 목록
캐시 갱신(저장 후 최신 상태 재표시 — last-write-wins). 400이면 필드 단위 안내(FR-010:
정제 카피).

**목록 필터**: `query`(제목·아티스트), `missing`(`video`\|`cover`) — FR-006.

## 3. UserAdminItem (읽기 + 역할 수정 — US3)

| 필드 | 타입 | 수정 | 비고 |
|---|---|---|---|
| id | string(uuid) | ✕ | = Supabase auth uid |
| email | string | ✕ | |
| display_name | string \| null | ✕ | |
| avatar_url | string \| null | ✕ | |
| role | 'USER' \| 'ADMIN' | ○ | 유일한 수정 가능 필드 |
| created_at | string(ISO) | ✕ | |

**규칙**: 자기 자신(`id === useMe().id`)의 ADMIN 해제는 **클라에서 선차단**(버튼 비활성
+ 안내)하고 서버도 409로 거부(FR-008 이중 방어). 역할 변경 성공 시 목록 캐시 갱신.

## 4. PageResponse<T> (공통)

기존 목록 계약 재사용: `{ items: T[], page, size, total_items, total_pages }`
(snake_case). 즐겨찾기·기록 화면과 동일한 "더 보기" 페이지 패턴.

## 5. 가드 상태 (클라 전용)

`useAdminGuard` 훅의 판별 상태 — 저장되지 않는 파생 상태:

| 상태 | 조건 | 동작 |
|---|---|---|
| checking | authStore `initialized` 전 또는 useMe 로딩 중 | 빈 화면(스피너) — 세션 하이드레이션 전 오판 방지(기존 authStore 가드 패턴) |
| denied | 비로그인, 또는 `me.role !== 'ADMIN'` | 홈(`/`) 조용한 리다이렉트(존재 비노출) |
| granted | `me.role === 'ADMIN'` | 어드민 셸 렌더 |

주의: 화면 가드는 UX 장치일 뿐 — 데이터 보호의 최종 강제는 서버 401/403(계약 §0).
어드민 이용 중 권한 상실 시 서버 403 응답을 받으면 denied로 전환한다.

## 6. Mock 데이터 (adminMock.ts)

계약 예시 응답과 **동일한 값**을 정본으로 유지한다(계약의 실행 가능한 사본).
시나리오 상수로 스펙 엣지 케이스를 커버:

| 시나리오 | 내용 | 검증 대상 |
|---|---|---|
| `normal` | 예시 응답 그대로(KR2 pass·KR3 fail 혼재) | 기본 렌더, 목표 대비 표시 |
| `empty` | 빈 배열 + completion_pct null | 분모 0 "데이터 없음"(엣지) |
| `error` | 오류 throw | FR-010 정제 카피·재시도 |
| `slow` | 지연 후 응답 | 로딩 상태(콜드스타트 흉내) |
