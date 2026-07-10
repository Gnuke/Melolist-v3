package com.melolist.search.client;

import java.util.List;

/**
 * ACRCloud identify 응답에서 파싱한 인식 결과 1건.
 * release_date는 부분 값("2014" 등)이 올 수 있어 문자열로 보존한다.
 */
public record AcrTrack(
        String acrid,
        String title,
        List<String> artists,
        String album,
        String releaseDate,
        Integer durationMs,
        double score
) {
    public String firstArtist() {
        return artists.isEmpty() ? null : artists.get(0);
    }
}
