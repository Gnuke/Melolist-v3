package com.melolist.search.client;

import java.util.List;

/**
 * 웹검색 기반 심층 곡 탐색 계약(spec 004). 실구현 {@link OpenAiWebSongFinderClient}
 * (Responses API + web_search 도구), 목업은 {@code ai-mock} 프로파일의
 * {@link com.melolist.search.client.mock.MockWebSongFinderClient}.
 *
 * <p>후보를 찾지 못하면 빈 목록(무결과 UX). 호출 실패는 예외 —
 * 타임아웃 컷(22s, R3)은 서비스 계층 책임.</p>
 */
public interface WebSongFinderClient {

    List<WebSongCandidate> findCandidates(String query);
}
