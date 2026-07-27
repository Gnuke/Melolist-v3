-- PROFILES — Supabase auth.users 미러(PRD §8.2). PK = auth 사용자 UUID(JWT sub), 최초 접근 시 JIT 프로비저닝(spec 001).
-- 적용: 2026-07-08 Supabase 프로젝트 초기 연결 시 생성(devlog 2026-07-08). 당시 SQL 사본이 저장소에 남지 않아
--       JPA 엔티티(Profile.java)와 PRD §8.2를 근거로 2026-07-27 소급 복원 — 신규 환경 재구성용.
-- 정책: RLS는 활성화하되 정책 없음(부록 A-2, 타 테이블과 동일). 인가는 앱 계층 단독.
--       id는 auth.users.id 값을 미러하지만 FK는 걸지 않는다 — 정합은 앱 계층 JIT가 보장(auth 스키마 없는 환경에서도 재구성 가능).
create table profiles (
  id                 uuid primary key,
  email              varchar(255) not null unique,
  display_name       varchar(100),
  avatar_url         text,
  role               varchar(20) not null default 'USER',
  review_hide_until  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table profiles enable row level security;
