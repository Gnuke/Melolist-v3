package com.melolist.search.domain;

/**
 * 검색 방식. ACRCloud identify 응답의 metadata 키({@code music}/{@code humming})와
 * 이벤트 properties의 {@code mode} 값을 함께 매핑한다.
 */
public enum SearchMode {

    FINGERPRINT("music", "fingerprint"),
    HUMMING("humming", "humming");

    /** identify 응답 {@code metadata.<key>} 배열 키. */
    private final String acrMetadataKey;
    /** 이벤트 사전의 mode 값(backend-prd §6.1). */
    private final String eventValue;

    SearchMode(String acrMetadataKey, String eventValue) {
        this.acrMetadataKey = acrMetadataKey;
        this.eventValue = eventValue;
    }

    public String acrMetadataKey() {
        return acrMetadataKey;
    }

    public String eventValue() {
        return eventValue;
    }
}
