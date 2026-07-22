package com.melolist.search.client;

import java.util.List;

/**
 * 자연어 곡 설명 → 후보 식별 계약(spec 002). 실구현 {@link OpenAiSongFinderClient},
 * 개발용 목업은 {@code ai-mock} 프로파일의
 * {@link com.melolist.search.client.mock.MockAiSongFinderClient}.
 *
 * <p>후보를 찾지 못하면 빈 목록(검색 실패 아님 — 무후보 UX로 처리).
 * 호출 실패는 예외 — 타임아웃 컷은 서비스 계층 책임.</p>
 */
public interface AiSongFinderClient {

    List<AiSongCandidate> findCandidates(String query);
}
