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
 * 심층 탐색 후보 선택 확정 요청(spec 004 contracts §3) — 저장 시점.
 * 후보는 검색 응답의 results[i] 항목 그대로(verified 포함), rank는 목록 내 순위(계측용).
 * acrid(ai-key)는 서버가 title/artists로 재계산해 대조한다(위조 방지 — 002와 동일).
 */
public record DeepSelectRequest(
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
            String coverUrl,
            Boolean verified
    ) {
        public String joinedArtists() {
            return artists == null || artists.isEmpty()
                    ? null
                    : String.join(", ", artists.stream().map(SearchResponse.Artist::name).toList());
        }
    }
}
