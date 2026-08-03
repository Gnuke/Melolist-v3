package com.melolist.search.client;

import java.util.List;

/**
 * LLM이 식별한 곡 후보(spec 002). videoId·커버는 여기 없다 —
 * 환각이 흔한 값이라 LLM에 요청하지 않고 {@link AcrMetadataClient}로 해석한다(R4).
 *
 * <p>titleAlt·artistAlt는 공식 영문(로마자) 표기 — ACR 카탈로그가 한글 곡을 영문으로만
 * 등재한 경우(표기 혼재, 실측: 흔적→"Trace") 1차 대조 0건이면 이 표기로 2차 대조한다.</p>
 */
public record AiSongCandidate(String title, List<String> artists, String album,
                              String titleAlt, String artistAlt) {

    /** 영문 표기 없는 후보용(기존 계약·테스트 호환). */
    public AiSongCandidate(String title, List<String> artists, String album) {
        this(title, artists, album, null, null);
    }

    public String firstArtist() {
        return artists == null || artists.isEmpty() ? null : artists.get(0);
    }

    public String joinedArtists() {
        return artists == null || artists.isEmpty() ? null : String.join(", ", artists);
    }
}
