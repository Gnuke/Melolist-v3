package com.melolist.search.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.music.domain.Music;
import com.melolist.music.dto.MusicResponse;
import com.melolist.search.domain.SearchHistory;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * 검색 기록 1건(M3 계약, snake_case). music은 top 곡 스냅샷 — no_match이거나
 * 곡 행이 사라졌으면 null(프론트는 "찾지 못한 검색" 행으로 렌더).
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record SearchHistoryResponse(
        Long id,
        String type,   // fingerprint | humming | text
        String status, // matched | no_match
        BigDecimal score,
        MusicResponse music,
        Instant createdAt
) {
    public static SearchHistoryResponse from(SearchHistory h, Music topMusic) {
        return new SearchHistoryResponse(
                h.getId(),
                h.getType().name().toLowerCase(),
                h.getStatus().name().toLowerCase(),
                h.getScore(),
                topMusic == null ? null : MusicResponse.from(topMusic),
                h.getCreatedAt()
        );
    }
}
