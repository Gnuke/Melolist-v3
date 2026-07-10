-- Melolist-v3 도메인 테이블 (M2~M4 대비) — PRD §8.2 + backend-prd §7 (C1·C2 개정 반영)
-- 적용: Supabase MCP apply_migration `create_domain_tables` (2026-07-10)
-- 정책: RLS는 활성화하되 정책 없음(PostgREST 익명 접근 차단). 인가는 앱 계층 단독(부록 A-2).
--       Spring은 테이블 소유 role로 직접 접속하므로 RLS를 bypass한다.

-- MUSIC — 인식 결과 eager 캐시. youtube_video_id가 재생 정본(C1), cover_url은 핫링크만(§9)
create table music (
  id                bigint generated always as identity primary key,
  acrid             varchar(64) unique,
  title             varchar(255) not null,
  artist            varchar(255),
  album             varchar(255),
  release_date      date,
  youtube_video_id  varchar(20),
  cover_url         text,
  duration_ms       int,
  source            varchar(20) not null default 'ACRCLOUD',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table music enable row level security;

-- SEARCH_HISTORY — 로그인 사용자의 "내 기록". audio_path는 원본 미저장 결정으로 항상 null
create table search_history (
  id            bigint generated always as identity primary key,
  user_id       uuid references profiles(id) on delete set null,
  type          varchar(20) not null,
  status        varchar(20) not null,
  top_music_id  bigint references music(id) on delete set null,
  score         numeric(5,2),
  audio_path    text,
  created_at    timestamptz not null default now()
);
create index idx_search_history_user on search_history (user_id, created_at desc);
alter table search_history enable row level security;

-- EVENT_LOG — 익명 계측(C2). user_id에 FK 없음(프로비저닝 전 사용자도 기록 가능해야 함)
create table event_log (
  id          bigint generated always as identity primary key,
  event_type  text not null,
  session_id  uuid not null,
  user_id     uuid,
  properties  jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index idx_event_log_type_time on event_log (event_type, created_at);
alter table event_log enable row level security;

-- PLAYLIST
create table playlist (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references profiles(id) on delete cascade,
  title       varchar(120) not null,
  description text,
  is_public   boolean not null default false,
  cover_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index idx_playlist_owner on playlist (owner_id);
create index idx_playlist_public on playlist (is_public, updated_at desc);
alter table playlist enable row level security;

-- PLAYLIST_MUSIC (조인)
create table playlist_music (
  id           bigint generated always as identity primary key,
  playlist_id  bigint not null references playlist(id) on delete cascade,
  music_id     bigint not null references music(id),
  position     int not null,
  added_at     timestamptz not null default now(),
  unique (playlist_id, music_id)
);
create index idx_playlist_music_playlist on playlist_music (playlist_id, position);
alter table playlist_music enable row level security;

-- FAVORITE
create table favorite (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  music_id    bigint not null references music(id),
  created_at  timestamptz not null default now(),
  unique (user_id, music_id)
);
create index idx_favorite_user on favorite (user_id, created_at desc);
alter table favorite enable row level security;

-- REVIEW — 앱 평가, 1인 1건(user_id unique)
create table review (
  id          bigint generated always as identity primary key,
  user_id     uuid not null unique references profiles(id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table review enable row level security;

-- COMMENT — 공유 플레이리스트 대상, parent_id로 1단 대댓글
create table comment (
  id           bigint generated always as identity primary key,
  author_id    uuid not null references profiles(id) on delete cascade,
  playlist_id  bigint not null references playlist(id) on delete cascade,
  parent_id    bigint references comment(id) on delete cascade,
  content      text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_comment_playlist on comment (playlist_id, created_at);
alter table comment enable row level security;
