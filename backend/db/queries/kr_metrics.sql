-- ============================================================================
-- Q3 OKR KR 산출 SQL (backend-prd §10) — Supabase SQL Editor에서 수동 실행
--
-- 대상 KR (docs/prd/okr-2026q3.md, 안A):
--   KR2 검색 응답 시간  : search_request.total_ms 의 p95 ≤ 6,000ms
--   KR3 첫 방문 검색 완료율 : search_result_shown 세션 ÷ visit 세션 ≥ 70%
--   (KR1 매칭률은 측정 스크립트(C6) 소관 — 이 파일 범위 아님)
--
-- 사용법: 각 쿼리의 기간(interval)만 조정해 실행. 기본 14일.
--
-- 해석 주의:
--  * 2026-07-14(PR #2) 이후 total_ms 는 응답 경로만 계측(upsert 는 비동기 분리).
--    이전 레코드는 upsert 가 total 에 포함돼 있어 직접 비교하면 안 된다.
--  * 2026-07-16(PR #4) 메타 보강 수정(artists 배열·타임아웃 4s) 전후로
--    meta_ms 분포가 다르다 — 회귀 비교 시 배포 시점으로 구간을 나눌 것.
--  * no_match 응답도 정상 응답이므로 KR2 모수에 포함한다(matched 무관).
-- ============================================================================


-- ── KR2. 검색 응답 시간 p95 (모드별 + 전체[mode=null 행]) ──────────────────
with req as (
  select
    properties->>'mode'                as mode,
    (properties->>'matched')::boolean  as matched,
    (properties->>'total_ms')::numeric as total_ms
  from event_log
  where event_type = 'search_request'
    and created_at >= now() - interval '14 days'
)
select
  mode,                                          -- null 행 = 전체
  count(*)                                                          as n,
  count(*) filter (where matched)                                   as matched_n,
  round(percentile_cont(0.50) within group (order by total_ms))     as p50_ms,
  round(percentile_cont(0.95) within group (order by total_ms))     as p95_ms,
  round(max(total_ms))                                              as max_ms,
  round(percentile_cont(0.95) within group (order by total_ms)) <= 6000 as kr2_pass
from req
group by rollup(mode)
order by mode nulls last;


-- ── KR2 보조. 구간 분해 p95 (병목 식별용 — DoD #3 "미달 시 병목 구간 식별") ──
with req as (
  select
    properties->>'mode'                 as mode,
    (properties->>'total_ms')::numeric  as total_ms,
    (properties->>'acr_ms')::numeric    as acr_ms,
    (properties->>'meta_ms')::numeric   as meta_ms,
    (properties->>'upsert_ms')::numeric as upsert_ms  -- 07-14 이후 비동기 측정치(응답 경로 밖)
  from event_log
  where event_type = 'search_request'
    and created_at >= now() - interval '14 days'
)
select
  mode,
  count(*)                                                       as n,
  round(percentile_cont(0.95) within group (order by acr_ms))    as acr_p95,
  round(percentile_cont(0.95) within group (order by meta_ms))   as meta_p95,
  round(percentile_cont(0.95) within group (order by upsert_ms)) as upsert_p95_async,
  round(percentile_cont(0.95) within group (order by total_ms))  as total_p95
from req
group by rollup(mode)
order by mode nulls last;


-- ── KR3. 첫 방문 검색 완료율 (세션 단위) ───────────────────────────────────
-- visit 은 프론트가 세션(탭·오리진)당 1회만 발화한다(§6.1) — 분모가 곧 방문 세션 수.
with base as (
  select event_type, session_id
  from event_log
  where created_at >= now() - interval '14 days'
    and event_type in ('visit', 'search_result_shown')
)
select
  count(distinct session_id) filter (where event_type = 'visit')               as visit_sessions,
  count(distinct session_id) filter (where event_type = 'search_result_shown') as completed_sessions,
  round(100.0 * count(distinct session_id) filter (where event_type = 'search_result_shown')
        / nullif(count(distinct session_id) filter (where event_type = 'visit'), 0), 1) as completion_pct,
  round(100.0 * count(distinct session_id) filter (where event_type = 'search_result_shown')
        / nullif(count(distinct session_id) filter (where event_type = 'visit'), 0), 1) >= 70 as kr3_pass
from base;


-- ── 참고. 주간 추이 (분기 체크인용 — brainstorming 5장 금요일 로그에 붙여넣기) ──
with req as (
  select
    date_trunc('week', created_at)::date as week,
    properties->>'mode'                  as mode,
    (properties->>'total_ms')::numeric   as total_ms
  from event_log
  where event_type = 'search_request'
)
select
  week,
  mode,
  count(*)                                                      as n,
  round(percentile_cont(0.95) within group (order by total_ms)) as p95_ms
from req
group by week, mode
order by week desc, mode;


-- ── 참고. 실패 사유 분포 (KR3 미달 원인 추적용) ────────────────────────────
select
  properties->>'mode'   as mode,
  properties->>'reason' as reason,
  count(*)              as n
from event_log
where event_type = 'search_failed'
  and created_at >= now() - interval '14 days'
group by 1, 2
order by n desc;


-- ============================================================================
-- spec 002 — AI 자연어 폴백 검색 SC 산출 (2026-07-21 추가, contracts §3)
--   SC-001 폴백 시도율 : 미매칭 세션 중 ai_fallback_open(from=no_match) 세션 ≥ 30%
--   SC-002 채택률      : ai_search_select ÷ ai_search_request(hit·empty) ≥ 40%
--   SC-003 응답 p95    : ai_search_request.total_ms p95 ≤ 15,000ms
--   SC-004 전환율      : 미매칭 세션 중 ai_search_select 발생 세션 ≥ 25%
-- 해석 주의: outcome=quota 는 한도 거절(수요 신호) — 시도·채택 분모에서 제외.
-- ============================================================================


-- ── SC-001·SC-004. 미매칭 세션의 폴백 시도율·전환율 ────────────────────────
with no_match_sessions as (
  select distinct session_id
  from event_log
  where event_type = 'search_failed'
    and properties->>'reason' = 'no_match'
    and created_at >= now() - interval '14 days'
), fallback as (
  select
    count(distinct session_id) filter (where event_type = 'ai_fallback_open'
      and properties->>'from' = 'no_match')                          as opened_sessions,
    count(distinct session_id) filter (where event_type = 'ai_search_select') as selected_sessions
  from event_log
  where created_at >= now() - interval '14 days'
    and session_id in (select session_id from no_match_sessions)
)
select
  (select count(*) from no_match_sessions)                                        as no_match_sessions,
  opened_sessions,
  selected_sessions,
  round(100.0 * opened_sessions   / nullif((select count(*) from no_match_sessions), 0), 1) as sc001_try_pct,
  round(100.0 * selected_sessions / nullif((select count(*) from no_match_sessions), 0), 1) as sc004_convert_pct
from fallback;


-- ── SC-002. 채택률 + SC-003. 응답 p95 (outcome 분포 포함) ──────────────────
with req as (
  select
    properties->>'outcome'              as outcome,
    (properties->>'total_ms')::numeric  as total_ms
  from event_log
  where event_type = 'ai_search_request'
    and created_at >= now() - interval '14 days'
), sel as (
  select count(*) as n
  from event_log
  where event_type = 'ai_search_select'
    and created_at >= now() - interval '14 days'
)
select
  count(*) filter (where outcome in ('hit', 'empty'))               as attempts,
  count(*) filter (where outcome = 'hit')                           as hits,
  count(*) filter (where outcome = 'error')                         as errors,
  count(*) filter (where outcome = 'quota')                         as quota_rejected,
  (select n from sel)                                               as selects,
  round(100.0 * (select n from sel)
        / nullif(count(*) filter (where outcome in ('hit', 'empty')), 0), 1) as sc002_select_pct,
  round(percentile_cont(0.95) within group (order by total_ms)
        filter (where outcome in ('hit', 'empty')))                 as sc003_p95_ms,
  round(percentile_cont(0.95) within group (order by total_ms)
        filter (where outcome in ('hit', 'empty'))) <= 15000        as sc003_pass
from req;


-- ── 참고. 채택 순위 분포 (후보 정렬 품질 — rank 1 채택이 많을수록 좋다) ────
select
  properties->>'rank'                  as rank,
  count(*)                             as n,
  count(*) filter (where (properties->>'resolved')::boolean) as resolved_n
from event_log
where event_type = 'ai_search_select'
  and created_at >= now() - interval '14 days'
group by 1
order by 1;


-- ============================================================================
-- spec 004 — 웹검색 심층 곡 탐색 SC 산출 (2026-08-04 추가, contracts §4)
--   SC-001 시도율      : AI 폴백 무결과·미채택 세션 중 deep_search_open 세션 ≥ 20%
--   SC-002 채택률      : deep_search_select ÷ deep_search_request(hit·empty) ≥ 30%
--   SC-003 응답 p95    : deep_search_request.total_ms p95 ≤ 30,000ms
--   SC-004 비용 캡     : 사용자·일자별 실행(outcome≠quota) 최댓값 ≤ 한도(2) — 초과 0건
--   SC-005 미확인 비중 : sum(unverified) ÷ sum(candidates)
-- 해석 주의: outcome=quota 는 한도 거절(수요 신호) — 시도·채택 분모에서 제외.
-- ============================================================================


-- ── SC-001. AI 폴백이 무결과/미채택으로 끝난 세션의 심층 탐색 시도율 ────────
with ai_dead_end_sessions as (
  -- AI 폴백을 시도했으나(요청 있음) 채택이 없었던 세션 = 무결과 + 후보 불만족
  select session_id
  from event_log
  where created_at >= now() - interval '14 days'
  group by session_id
  having count(*) filter (where event_type = 'ai_search_request'
           and properties->>'outcome' in ('hit', 'empty')) > 0
     and count(*) filter (where event_type = 'ai_search_select') = 0
), deep as (
  select count(distinct session_id) as opened_sessions
  from event_log
  where event_type = 'deep_search_open'
    and created_at >= now() - interval '14 days'
    and session_id in (select session_id from ai_dead_end_sessions)
)
select
  (select count(*) from ai_dead_end_sessions)  as dead_end_sessions,
  opened_sessions,
  round(100.0 * opened_sessions
        / nullif((select count(*) from ai_dead_end_sessions), 0), 1) as sc001_try_pct
from deep;


-- ── SC-002. 채택률 + SC-003. 응답 p95 + SC-005. 미확인 비중 ────────────────
with req as (
  select
    properties->>'outcome'                as outcome,
    (properties->>'total_ms')::numeric    as total_ms,
    (properties->>'candidates')::numeric  as candidates,
    (properties->>'unverified')::numeric  as unverified
  from event_log
  where event_type = 'deep_search_request'
    and created_at >= now() - interval '14 days'
), sel as (
  select count(*) as n
  from event_log
  where event_type = 'deep_search_select'
    and created_at >= now() - interval '14 days'
)
select
  count(*) filter (where outcome in ('hit', 'empty'))               as attempts,
  count(*) filter (where outcome = 'hit')                           as hits,
  count(*) filter (where outcome = 'error')                         as errors,
  count(*) filter (where outcome = 'quota')                         as quota_rejected,
  (select n from sel)                                               as selects,
  round(100.0 * (select n from sel)
        / nullif(count(*) filter (where outcome in ('hit', 'empty')), 0), 1) as sc002_select_pct,
  round(percentile_cont(0.95) within group (order by total_ms)
        filter (where outcome in ('hit', 'empty')))                 as sc003_p95_ms,
  round(percentile_cont(0.95) within group (order by total_ms)
        filter (where outcome in ('hit', 'empty'))) <= 30000        as sc003_pass,
  round(100.0 * sum(unverified) filter (where outcome = 'hit')
        / nullif(sum(candidates) filter (where outcome = 'hit'), 0), 1) as sc005_unverified_pct
from req;


-- ── SC-004. 비용 캡 검증 — 사용자·일자별 실행 수가 한도를 넘은 날이 없어야 한다 ──
select
  user_id,
  (created_at at time zone 'Asia/Seoul')::date as day_kst,
  count(*)                                     as executed
from event_log
where event_type = 'deep_search_request'
  and coalesce(properties->>'outcome', '') <> 'quota'
group by 1, 2
having count(*) > 2   -- 한도(user-daily) 초과분만 — 0행이면 SC-004 통과
order by 2 desc;


-- ── 참고. 심층 채택의 확인/미확인·순위 분포 (미확인 라벨 품질 신호) ─────────
select
  properties->>'rank'                                          as rank,
  count(*)                                                     as n,
  count(*) filter (where (properties->>'verified')::boolean)   as verified_n,
  count(*) filter (where (properties->>'resolved')::boolean)   as resolved_n
from event_log
where event_type = 'deep_search_select'
  and created_at >= now() - interval '14 days'
group by 1
order by 1;
