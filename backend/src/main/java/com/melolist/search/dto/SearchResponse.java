package com.melolist.search.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.util.List;

/**
 * 검색 응답 — M2 계약(backend-prd §6.1, frontend-prd §8과 동일 유지).
 * 무결과(F2)는 에러가 아니라 200 + 빈 배열.
 */
public record SearchResponse(List<TrackResult> results) {

    public static SearchResponse empty() {
        return new SearchResponse(List.of());
    }

    /**
     * 인식 결과 1곡. score는 허밍만 의미 있고 지문은 프론트가 노출하지 않는다(프론트 규칙).
     * youtube_url은 videoId에서 파생(C1), cover_url null이면 플레이스홀더는 프론트 책임.
     *
     * <p>{@code verified}는 심층 탐색(spec 004) 전용 — 카탈로그 대조 성공 여부.
     * NON_NULL이라 기존 경로(9-인자 생성자)에서는 키 자체가 직렬화되지 않는다(계약 무변화).</p>
     */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record TrackResult(
            String acrid,
            String title,
            List<Artist> artists,
            Album album,
            String releaseDate,
            Double score,
            String youtubeVideoId,
            String youtubeUrl,
            String coverUrl,
            @JsonInclude(JsonInclude.Include.NON_NULL) Boolean verified
    ) {
        /** 기존 인식·폴백 경로용 — verified 미표기. */
        public TrackResult(String acrid, String title, List<Artist> artists, Album album,
                           String releaseDate, Double score, String youtubeVideoId,
                           String youtubeUrl, String coverUrl) {
            this(acrid, title, artists, album, releaseDate, score, youtubeVideoId, youtubeUrl, coverUrl, null);
        }
    }

    public record Artist(String name) {
    }

    public record Album(String name) {
    }
}
