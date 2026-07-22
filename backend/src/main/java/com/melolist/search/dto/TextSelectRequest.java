package com.melolist.search.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/**
 * AI 폴백 후보 선택 확정 요청(spec 002 contracts §2) — 유일한 저장 시점.
 * 후보는 검색 응답의 results[i] 항목 그대로, rank는 목록 내 순위(계측용).
 * acrid(ai-key)는 서버가 title/artists로 재계산해 대조한다(위조 방지).
 */
public record TextSelectRequest(
        @NotNull @Valid Candidate candidate,
        @NotNull @Min(1) @Max(5) Integer rank
) {
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Candidate(
            @NotBlank String acrid,
            @NotBlank String title,
            @NotNull List<SearchResponse.Artist> artists,
            SearchResponse.Album album,
            String youtubeVideoId,
            String coverUrl
    ) {
        public String joinedArtists() {
            return artists == null || artists.isEmpty()
                    ? null
                    : String.join(", ", artists.stream().map(SearchResponse.Artist::name).toList());
        }
    }
}
