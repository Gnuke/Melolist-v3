package com.melolist.common.error;

import java.time.ZonedDateTime;

/**
 * AI 폴백 검색 일일 한도 초과 → 429 + 표준 바디(code=AI_QUOTA_EXCEEDED,
 * details={limit, reset_at}). spec 002 contracts §1.
 */
public class AiQuotaExceededException extends RuntimeException {

    private final int limit;
    private final ZonedDateTime resetAt;

    public AiQuotaExceededException(int limit, ZonedDateTime resetAt) {
        super("오늘의 AI 검색 횟수를 모두 사용했어요.");
        this.limit = limit;
        this.resetAt = resetAt;
    }

    public int getLimit() {
        return limit;
    }

    public ZonedDateTime getResetAt() {
        return resetAt;
    }
}
