package com.melolist.search.service;

import com.melolist.common.error.AiQuotaExceededException;
import com.melolist.event.repository.EventLogRepository;
import com.melolist.search.config.AiProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/**
 * AI 폴백 검색 일일 한도(spec 002, R6) — 게스트=세션(3회), 로그인=계정(10회).
 * 판정 원천은 event_log의 {@code ai_search_request}(서버 기록이라 클라 조작 불가).
 * Render 무료 티어는 재시작이 잦아 인메모리 카운터가 무력화되므로 DB 카운트를 쓴다.
 * outcome=quota(거절된 요청)는 카운트에서 제외 — 429 반복이 한도를 밀어내지 않는다.
 */
@Service
@RequiredArgsConstructor
public class AiQuotaService {

    static final String COUNTED_EVENT_TYPE = "ai_search_request";
    private static final ZoneId RESET_ZONE = ZoneId.of("Asia/Seoul");

    private final EventLogRepository eventLogRepository;
    private final AiProperties aiProperties;

    /** 한도 초과면 {@link AiQuotaExceededException}(429). 통과면 조용히 리턴. */
    @Transactional(readOnly = true)
    public void checkQuota(UUID sessionId, UUID userId) {
        ZonedDateTime dayStart = ZonedDateTime.now(RESET_ZONE).truncatedTo(ChronoUnit.DAYS);
        Instant since = dayStart.toInstant();

        int limit = userId != null
                ? aiProperties.quota().userDaily()
                : aiProperties.quota().guestDaily();
        long used = userId != null
                ? eventLogRepository.countByTypeAndUserSince(COUNTED_EVENT_TYPE, userId, since)
                : eventLogRepository.countByTypeAndSessionSince(COUNTED_EVENT_TYPE, sessionId, since);

        if (used >= limit) {
            throw new AiQuotaExceededException(limit, dayStart.plusDays(1));
        }
    }
}
