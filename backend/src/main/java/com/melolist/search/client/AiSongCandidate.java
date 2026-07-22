package com.melolist.search.client;

import java.util.List;

/**
 * LLM이 식별한 곡 후보(spec 002). videoId·커버는 여기 없다 —
 * 환각이 흔한 값이라 LLM에 요청하지 않고 {@link AcrMetadataClient}로 해석한다(R4).
 */
public record AiSongCandidate(String title, List<String> artists, String album) {

    public String firstArtist() {
        return artists == null || artists.isEmpty() ? null : artists.get(0);
    }

    public String joinedArtists() {
        return artists == null || artists.isEmpty() ? null : String.join(", ", artists);
    }
}
