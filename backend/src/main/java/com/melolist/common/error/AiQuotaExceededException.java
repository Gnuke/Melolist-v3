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
        this(limit, resetAt, "오늘의 AI 검색 횟수를 모두 사용했어요.");
    }

    /** 심층 탐색(spec 004) 등 한도 종류별 안내 문구 분기용 — 코드(AI_QUOTA_EXCEEDED)는 공유. */
    public AiQuotaExceededException(int limit, ZonedDateTime resetAt, String message) {
        super(message);
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
