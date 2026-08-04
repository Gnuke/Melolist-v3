package com.melolist.search.service;

import com.melolist.common.error.AiQuotaExceededException;
import com.melolist.event.repository.EventLogRepository;
import com.melolist.search.config.AiProperties;
import com.melolist.search.config.DeepSearchProperties;
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
 *
 * <p>심층 탐색(spec 004)은 별도 원장({@code deep_search_request})·로그인 전용·독립
 * 한도(기본 2회/일) — 같은 카운트 패턴을 공유한다.</p>
 */
@Service
@RequiredArgsConstructor
public class AiQuotaService {

    static final String COUNTED_EVENT_TYPE = "ai_search_request";
    static final String DEEP_COUNTED_EVENT_TYPE = "deep_search_request";
    private static final ZoneId RESET_ZONE = ZoneId.of("Asia/Seoul");

    private final EventLogRepository eventLogRepository;
    private final AiProperties aiProperties;
    private final DeepSearchProperties deepProperties;

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

    /** 심층 탐색 한도 검사(spec 004) — 로그인 전용이라 세션 키 경로가 없다. */
    @Transactional(readOnly = true)
    public void checkDeepQuota(UUID userId) {
        DeepUsage usage = deepUsage(userId);
        if (usage.remaining() <= 0) {
            throw new AiQuotaExceededException(usage.limit(), usage.resetAt(),
                    "오늘의 심층 탐색 횟수를 모두 사용했어요.");
        }
    }

    /** 확인 단계 UI 원천(FR-002) — GET /api/search/deep/quota가 그대로 반환한다. */
    @Transactional(readOnly = true)
    public DeepUsage deepUsage(UUID userId) {
        ZonedDateTime dayStart = ZonedDateTime.now(RESET_ZONE).truncatedTo(ChronoUnit.DAYS);
        int limit = deepProperties.userDaily();
        long used = eventLogRepository.countByTypeAndUserSince(
                DEEP_COUNTED_EVENT_TYPE, userId, dayStart.toInstant());
        int remaining = (int) Math.max(0, limit - used);
        return new DeepUsage(limit, (int) used, remaining, dayStart.plusDays(1));
    }

    public record DeepUsage(int limit, int used, int remaining, ZonedDateTime resetAt) {
    }
}
