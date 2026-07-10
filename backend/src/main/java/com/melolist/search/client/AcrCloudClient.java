package com.melolist.search.client;

import com.melolist.search.domain.SearchMode;

import java.util.List;

/**
 * ACRCloud identify(지문/허밍 인식) 클라이언트 계약.
 * 실구현 {@link AcrCloudHttpClient}, 개발용 목업은 {@code acr-mock} 프로파일의
 * {@link com.melolist.search.client.mock.MockAcrCloudClient}.
 */
public interface AcrCloudClient {

    /** 오디오를 identify에 투입해 인식 결과 목록을 반환한다. 무결과면 빈 리스트. */
    List<AcrTrack> identify(byte[] audio, SearchMode mode);
}
