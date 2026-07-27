-- 어드민 지원 — 감사 테이블 신설 + 곡 메타 잠금 컬럼(spec 003 data-model §1·§2·§5)
-- 적용: Supabase MCP apply_migration `add_admin_audit_and_music_lock` (2026-07-22). SQL 사본 소급 등록(2026-07-27).
-- 관리자 지정은 수동(FR-002): update profiles set role = 'ADMIN' where email = '<운영자>';
--   (profiles.role 컬럼 자체는 20260708_create_profiles.sql에서 생성 — 본 마이그레이션은 music/admin_audit_log만 변경)

-- MUSIC — 관리자 수동 정정 표시. true면 검색 파이프라인의 자동 보강(fillMissing)이 이 곡을 덮어쓰지 않는다(FR-007)
alter table music add column meta_locked boolean not null default false;

-- ADMIN_AUDIT_LOG — 관리자 변경 작업 감사. 변경과 동일 트랜잭션에서 기록(SC-004).
-- admin_id에 FK를 걸지 않는다 — 감사 행은 프로필 삭제와 무관하게 보존.
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
-- RLS: 전 테이블 정책(RLS on·정책 없음)에 맞춰 포함. data-model §5의 적용 SQL에는 이 줄이 기록되어 있지 않으므로
--      운영 DB의 relrowsecurity 반영 여부는 별도 확인 필요.
alter table admin_audit_log enable row level security;
