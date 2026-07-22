package com.melolist.event.repository;

import com.melolist.event.domain.EventLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.UUID;

public interface EventLogRepository extends JpaRepository<EventLog, Long> {

    /*
     * AI 폴백 일일 한도 카운트(spec 002, R6) — outcome=quota(한도 초과로 거절된 요청)는
     * 소모로 치지 않는다. properties ->> 는 Postgres JSON 연산자(운영·mock E2E 전용,
     * 단위 테스트는 repo를 mock — H2에서 실행하지 않는다).
     */

    @Query(value = """
            select count(*) from event_log
            where event_type = :type
              and user_id = :userId
              and created_at >= :since
              and coalesce(properties ->> 'outcome', '') <> 'quota'
            """, nativeQuery = true)
    long countByTypeAndUserSince(@Param("type") String type,
                                 @Param("userId") UUID userId,
                                 @Param("since") Instant since);

    @Query(value = """
            select count(*) from event_log
            where event_type = :type
              and session_id = :sessionId
              and created_at >= :since
              and coalesce(properties ->> 'outcome', '') <> 'quota'
            """, nativeQuery = true)
    long countByTypeAndSessionSince(@Param("type") String type,
                                    @Param("sessionId") UUID sessionId,
                                    @Param("since") Instant since);
}
