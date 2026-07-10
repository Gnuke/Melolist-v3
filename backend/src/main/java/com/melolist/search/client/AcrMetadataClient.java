package com.melolist.search.client;

import com.melolist.search.domain.SearchMode;

/**
 * ACRCloud Metadata API(커버·유튜브 videoId 보강) 클라이언트 계약.
 * 실구현 {@link AcrMetadataHttpClient}, 개발용 목업은 {@code acr-mock} 프로파일의
 * {@link com.melolist.search.client.mock.MockAcrMetadataClient}.
 */
public interface AcrMetadataClient {

    /**
     * 곡명·아티스트로 보강 데이터를 조회한다.
     * 실패·타임아웃은 {@link MetaEnrichment#EMPTY} — 검색 응답을 막지 않는다.
     */
    MetaEnrichment lookup(String track, String artist, SearchMode mode);
}
