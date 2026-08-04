package com.melolist.search.client;

import java.util.List;

/**
 * 웹검색이 식별한 곡 후보(spec 004, data-model §1) — {@link AiSongCandidate}의 확장형.
 * 차이는 {@code youtubeVideoId} 하나: 웹 근거 링크에서 서버가 추출·검증한 값(R5)으로,
 * 카탈로그 대조 실패(미확인) 후보의 재생·저장에 쓴다. 검증 실패·미확인이면 null.
 */
public record WebSongCandidate(String title, List<String> artists, String album,
                               String titleAlt, String artistAlt, String youtubeVideoId) {

    /** 메타 대조(CandidateMetaVerifier)·ai-key 계산은 002 후보 타입 계약을 그대로 쓴다. */
    public AiSongCandidate asAiCandidate() {
        return new AiSongCandidate(title, artists, album, titleAlt, artistAlt);
    }

    public String joinedArtists() {
        return artists == null || artists.isEmpty() ? null : String.join(", ", artists);
    }
}
