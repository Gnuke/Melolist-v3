package com.melolist.search.client;

/**
 * Metadata API 보강 결과 — 커버·유튜브 videoId(§5.2). 조회 실패/타임아웃이면 EMPTY
 * (보강 실패는 검색 실패가 아니다).
 */
public record MetaEnrichment(String youtubeVideoId, String coverUrl) {

    public static final MetaEnrichment EMPTY = new MetaEnrichment(null, null);

    /** 카탈로그 대조 성공 여부 — 실존 근거(videoId·커버) 중 하나라도 있으면 true. */
    public boolean verified() {
        return youtubeVideoId != null || coverUrl != null;
    }

    /** 커버 3단 폴백(§5.2): album.covers.medium → ytimg → null. */
    public String coverUrlOrFallback() {
        if (coverUrl != null) {
            return coverUrl;
        }
        if (youtubeVideoId != null) {
            return "https://i.ytimg.com/vi/" + youtubeVideoId + "/mqdefault.jpg";
        }
        return null;
    }
}
