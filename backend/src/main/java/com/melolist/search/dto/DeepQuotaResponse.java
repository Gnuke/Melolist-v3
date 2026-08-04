package com.melolist.search.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * 심층 탐색 잔여 횟수(spec 004 contracts §1) — 확인 단계 UI 원천(FR-002).
 * reset_at은 Asia/Seoul 자정, ISO_OFFSET_DATE_TIME.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record DeepQuotaResponse(int limit, int used, int remaining, String resetAt) {
}
