package com.melolist.admin.repository;

import com.melolist.event.domain.EventLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * 어드민 전용 지표·사용자 native query(research D3·D4). 지표 정의는
 * {@code backend/db/queries/kr_metrics.sql}을 그대로 이식했다(SC-006).
 *
 * <p>event_log 쿼리는 전부 event_type+created_at 조건을 포함해 기존 인덱스
 * {@code (event_type, created_at)}를 사용한다(FR-014). EventLogRepository는
 * 병행 브랜치가 수정 중이라 건드리지 않고 같은 엔티티에 별도 리포지토리를 둔다.</p>
 */
public interface AdminStatsRepository extends Repository<EventLog, Long> {

    // ── 지표(US1) ──────────────────────────────────────────────────────────

    interface ModeStatsRow {
        String getMode();

        Long getN();

        Long getMatchedN();

        Double getP50Ms();

        Double getP95Ms();

        Double getMaxMs();
    }

    /** KR2 — search_request의 모드별+전체(rollup) 응답 시간 분포. no_match도 모수 포함. */
    @Query(value = """
            with req as (
              select properties->>'mode'                as mode,
                     (properties->>'matched')::boolean  as matched,
                     (properties->>'total_ms')::numeric as total_ms
              from event_log
              where event_type = 'search_request'
                and created_at >= :fromTs and created_at < :toTs
            )
            select mode                                                          as "mode",
                   count(*)                                                      as "n",
                   count(*) filter (where matched)                               as "matchedN",
                   round(percentile_cont(0.50) within group (order by total_ms)) as "p50Ms",
                   round(percentile_cont(0.95) within group (order by total_ms)) as "p95Ms",
                   round(max(total_ms))                                          as "maxMs"
            from req
            group by rollup(mode)
            order by mode nulls last
            """, nativeQuery = true)
    List<ModeStatsRow> modeStats(@Param("fromTs") Instant fromTs, @Param("toTs") Instant toTs);

    interface Kr2BreakdownRow {
        String getMode();

        Long getN();

        Double getAcrP95Ms();

        Double getMetaP95Ms();

        Double getUpsertP95Ms();

        Double getTotalP95Ms();
    }

    /** KR2 보조 — 구간 분해 p95(kr_metrics.sql "KR2 보조" 정의). upsert는 비동기 측정치. */
    @Query(value = """
            with req as (
              select properties->>'mode'                 as mode,
                     (properties->>'total_ms')::numeric  as total_ms,
                     (properties->>'acr_ms')::numeric    as acr_ms,
                     (properties->>'meta_ms')::numeric   as meta_ms,
                     (properties->>'upsert_ms')::numeric as upsert_ms
              from event_log
              where event_type = 'search_request'
                and created_at >= :fromTs and created_at < :toTs
            )
            select mode                                                           as "mode",
                   count(*)                                                       as "n",
                   round(percentile_cont(0.95) within group (order by acr_ms))    as "acrP95Ms",
                   round(percentile_cont(0.95) within group (order by meta_ms))   as "metaP95Ms",
                   round(percentile_cont(0.95) within group (order by upsert_ms)) as "upsertP95Ms",
                   round(percentile_cont(0.95) within group (order by total_ms))  as "totalP95Ms"
            from req
            group by rollup(mode)
            order by mode nulls last
            """, nativeQuery = true)
    List<Kr2BreakdownRow> kr2Breakdown(@Param("fromTs") Instant fromTs, @Param("toTs") Instant toTs);

    interface CompletionRow {
        Long getVisitSessions();

        Long getCompletedSessions();
    }

    /** KR3 — 검색 완료율 분자·분모(distinct 세션). 비율 계산은 서비스에서. */
    @Query(value = """
            select count(distinct session_id) filter (where event_type = 'visit')               as "visitSessions",
                   count(distinct session_id) filter (where event_type = 'search_result_shown') as "completedSessions"
            from event_log
            where event_type in ('visit', 'search_result_shown')
              and created_at >= :fromTs and created_at < :toTs
            """, nativeQuery = true)
    CompletionRow completion(@Param("fromTs") Instant fromTs, @Param("toTs") Instant toTs);

    interface FailureRow {
        String getMode();

        String getReason();

        Long getN();
    }

    /** search_failed 사유 분포 — n 내림차순. */
    @Query(value = """
            select properties->>'mode'   as "mode",
                   properties->>'reason' as "reason",
                   count(*)              as "n"
            from event_log
            where event_type = 'search_failed'
              and created_at >= :fromTs and created_at < :toTs
            group by 1, 2
            order by count(*) desc
            """, nativeQuery = true)
    List<FailureRow> failures(@Param("fromTs") Instant fromTs, @Param("toTs") Instant toTs);

    interface WeeklyRow {
        LocalDate getWeek();

        String getMode();

        Long getN();

        Double getP95Ms();
    }

    /** 주간 추이(kr_metrics.sql "주간 추이" 정의) — 기간과 무관하게 전체, 최신 주 먼저. */
    @Query(value = """
            with req as (
              select date_trunc('week', created_at)::date as week,
                     properties->>'mode'                  as mode,
                     (properties->>'total_ms')::numeric   as total_ms
              from event_log
              where event_type = 'search_request'
            )
            select week                                                          as "week",
                   mode                                                          as "mode",
                   count(*)                                                      as "n",
                   round(percentile_cont(0.95) within group (order by total_ms)) as "p95Ms"
            from req
            group by week, mode
            order by week desc, mode
            """, nativeQuery = true)
    List<WeeklyRow> weekly();

    interface CumulativeCountsRow {
        Long getUserCount();

        Long getMusicCount();
    }

    /** 누적 카운트(front 계약 §1 totals) — profiles·music 전체 수. */
    @Query(value = """
            select (select count(*) from profiles) as "userCount",
                   (select count(*) from music)    as "musicCount"
            """, nativeQuery = true)
    CumulativeCountsRow cumulativeCounts();

    // ── 사용자 조회(US3) ────────────────────────────────────────────────────

    interface ProfileRow {
        UUID getId();

        String getEmail();

        String getDisplayName();

        String getAvatarUrl();

        String getRole();

        Instant getCreatedAt();
    }

    @Query(value = """
            select id as "id", email as "email", display_name as "displayName",
                   avatar_url as "avatarUrl", role as "role", created_at as "createdAt"
            from profiles
            order by created_at desc
            """,
            countQuery = "select count(*) from profiles",
            nativeQuery = true)
    Page<ProfileRow> listUsers(Pageable pageable);

    @Query(value = """
            select id as "id", email as "email", display_name as "displayName",
                   avatar_url as "avatarUrl", role as "role", created_at as "createdAt"
            from profiles
            where email ilike '%' || :query || '%' or display_name ilike '%' || :query || '%'
            order by created_at desc
            """,
            countQuery = """
            select count(*) from profiles
            where email ilike '%' || :query || '%' or display_name ilike '%' || :query || '%'
            """,
            nativeQuery = true)
    Page<ProfileRow> searchUsers(@Param("query") String query, Pageable pageable);

    interface UserActivityRow {
        Long getSearchCount();

        Long getFavoriteCount();

        Long getPlaylistCount();

        Boolean getHasReview();
    }

    /** 사용자 활동 요약(집계 수치만 — FR-013 개인정보 경계) — 단일 왕복으로 집계. */
    @Query(value = """
            select (select count(*) from search_history where user_id = :userId) as "searchCount",
                   (select count(*) from favorite where user_id = :userId)       as "favoriteCount",
                   (select count(*) from playlist where owner_id = :userId)      as "playlistCount",
                   exists(select 1 from review where user_id = :userId)          as "hasReview"
            """, nativeQuery = true)
    UserActivityRow userActivity(@Param("userId") UUID userId);
}
