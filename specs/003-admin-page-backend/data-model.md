# Data Model: 관리자 어드민 백엔드

**Date**: 2026-07-22 · **근거**: spec.md Key Entities + research.md D2·D5·D6

## 1. 신규 테이블 — `admin_audit_log`

관리자 변경 작업의 감사 이력. 본 기능이 도입하는 유일한 신규 테이블(D5).

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | bigint | PK, generated always as identity | |
| admin_id | uuid | not null | 수행 관리자(profiles.id). FK 미설정 — 감사 행은 프로필 삭제와 무관하게 보존 |
| action | text | not null | `MUSIC_UPDATE` \| `MUSIC_DELETE` \| `REVIEW_DELETE` \| `COMMENT_DELETE` \| `PLAYLIST_UNPUBLISH` |
| target_type | text | not null | `MUSIC` \| `REVIEW` \| `COMMENT` \| `PLAYLIST` |
| target_id | text | not null | 대상 PK 문자열화(타입 혼재 대응) |
| detail | jsonb | not null default '{}' | 변경 전/후 스냅샷 — `{"before": {...}, "after": {...}}` (삭제는 before만) |
| created_at | timestamptz | not null default now() | |

인덱스: `(created_at)` — 후속 감사 조회 대비. 조회 API는 본 범위 외(FR-011은 기록만 의무).

**기록 규칙 (SC-004)**:
- 변경 작업과 **동일 트랜잭션**에서 동기 기록 — 기록 실패 시 변경도 롤백(누락 0건 보장).
- detail 스냅샷은 대상의 계약 필드만 담는다(예: 곡이면 title·artist·album·youtube_video_id·cover_url·meta_locked).

## 2. 기존 테이블 변경 — `music` 컬럼 1개 추가

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| meta_locked | boolean | not null default false | **관리자 수동 정정 표시**(D2). true면 검색 파이프라인의 자동 보강(fillMissing)이 이 곡을 건드리지 않는다 |

상태 전이: `false → true` — 관리자 PATCH 성공 시에만. 해제(true→false) 경로는 본 범위에
없다(정정 철회가 필요하면 다시 PATCH로 올바른 값을 쓰면 된다).

`Music` 엔티티에 `metaLocked` 필드 매핑 추가(spec 002 미수정 파일 — 충돌 없음).

## 3. 파생 read model — 운영 지표 (저장 없음)

기존 `event_log`·`profiles`에서 조회 시점에 산출(D3). 신규 저장·계측 없음.

| 모델 | 원천 | 정의(= kr_metrics.sql과 동일) |
|---|---|---|
| 모드별 검색 통계 | event_log `search_request` | n·matched_n·p50/p95/max(total_ms), rollup으로 전체 행 포함. no_match도 모수 포함 |
| KR2 판정 | 〃 | 전체 p95 ≤ 6,000ms |
| 검색 완료율(KR3) | event_log `visit`·`search_result_shown` | distinct 세션 비율, ≥70% 판정 |
| 실패 사유 분포 | event_log `search_failed` | mode × reason 카운트 |
| 일별 추이 | event_log + profiles | 일별 방문 세션(distinct)·검색 수·가입 수(profiles.created_at). 일 경계는 Asia/Seoul |

## 4. 기존 엔티티 — 조회·조치만 (구조 무변경)

| 엔티티 | admin에서의 사용 | 접근 방식 |
|---|---|---|
| Profile(profiles) | 역할 판정(role='ADMIN') · 사용자 목록/상세 · 가입 추이 | ProfileRepository 기존 메서드 + AdminStatsRepository 신규 쿼리 |
| Music | 목록/검색/상세/수정/삭제 | AdminMusicRepository(신규) + MusicRepository 기존 메서드 |
| Favorite · PlaylistMusic · SearchHistory | 곡 참조 카운트(삭제 차단 판단) · 사용자 활동 요약 | AdminMusicRepository·AdminStatsRepository 신규 카운트 쿼리 |
| Review | 목록(작성자 포함)·삭제 | ReviewRepository 기존 메서드 + admin 신규 목록 쿼리 |
| Comment | 삭제(대댓글 동반 — deleteByParentId 재사용) | CommentRepository 기존 메서드 |
| Playlist | 비공개 전환(is_public=false) | PlaylistRepository 기존 메서드 |

**불변 조건**:
- 기존 테이블의 컬럼·제약은 `music.meta_locked` 외 일절 변경하지 않는다(FR-012).
- 관리자 조치는 대상 행만 변경한다 — 리뷰 삭제가 작성자 프로필에, 비공개 전환이
  플레이리스트 트랙에 영향을 주지 않는다(FR-010).
- 게스트 식별 정보는 어떤 admin 응답에도 세션 UUID 이상으로 노출되지 않는다(FR-013).

## 5. 마이그레이션 (D6)

Supabase 마이그레이션 `add_admin_audit_and_music_lock` 1건:

```sql
alter table music add column meta_locked boolean not null default false;

create table admin_audit_log (
  id          bigint generated always as identity primary key,
  admin_id    uuid not null,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  detail      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on admin_audit_log (created_at);
```

관리자 지정(수동, FR-002): `update profiles set role = 'ADMIN' where email = '<운영자>';`
