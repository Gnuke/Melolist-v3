package com.melolist.search.client;

/**
 * Metadata API 보강 결과 — 커버·유튜브 videoId(§5.2) + 반환 아티스트(동명이곡 오염 판정용).
 * 조회 실패/타임아웃이면 EMPTY (보강 실패는 검색 실패가 아니다).
 */
public record MetaEnrichment(String youtubeVideoId, String coverUrl, java.util.List<String> artists) {

    public static final MetaEnrichment EMPTY = new MetaEnrichment(null, null);

    /** 반환 아티스트가 없는 결과용(기존 계약·mock 호환 — 아티스트 비교는 통과 처리). */
    public MetaEnrichment(String youtubeVideoId, String coverUrl) {
        this(youtubeVideoId, coverUrl, java.util.List.of());
    }

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
