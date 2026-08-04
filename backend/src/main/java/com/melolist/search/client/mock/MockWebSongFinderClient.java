package com.melolist.search.client.mock;

import com.melolist.common.error.ExternalApiException;
import com.melolist.search.client.WebSongCandidate;
import com.melolist.search.client.WebSongFinderClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 웹검색 심층 탐색 목업 — {@code ai-mock} 프로파일 전용(spec 004, FR-011).
 * OpenAI 실호출 없이(비용 0) 심층 흐름 전체(확인 단계→진행→미확인 라벨→선택→저장)를 검증.
 *
 * <p>시나리오 전환: 환경변수 {@code DEEP_MOCK_SCENARIO} = hit | unverified | empty |
 * error | slow (기본 hit).</p>
 *
 * <ul>
 *   <li>hit — 좋은 날(MockAcrMetadataClient 등록곡 → verified) + 밤편지(미등록 +
 *       웹 videoId → 미확인 라벨+링크) 혼재</li>
 *   <li>unverified — 전부 카탈로그 미등록(신곡 시뮬): 웹 링크 있는 후보 + 링크 없는 후보</li>
 *   <li>slow — 15s 지연(진행 표시·취소 검증용, 22s 컷 안이라 기다리면 성공)</li>
 * </ul>
 */
@Component
@Profile("ai-mock")
@Slf4j
public class MockWebSongFinderClient implements WebSongFinderClient {

    /** web_ms 타이밍이 그럴듯하게 나오도록 발동 흉내 지연. */
    private static final long LATENCY_MS = 1_500;
    private static final long SLOW_LATENCY_MS = 15_000;

    private final String scenario;

    public MockWebSongFinderClient(@Value("${melolist.ai.deep.mock.scenario:hit}") String scenario) {
        this.scenario = scenario;
        log.warn("★ 심층 탐색 MOCK 활성(ai-mock 프로파일) — scenario={} (실호출 없음)", scenario);
    }

    @Override
    public List<WebSongCandidate> findCandidates(String query) {
        switch (scenario) {
            case "unverified" -> {
                sleep(LATENCY_MS);
                return List.of(
                        new WebSongCandidate("새벽의 신곡", List.of("신인가수"), null, null, null, "mockWebVid1"),
                        new WebSongCandidate("링크 없는 신곡", List.of("무명가수"), null, null, null, null));
            }
            case "empty" -> {
                sleep(LATENCY_MS);
                return List.of();
            }
            case "error" -> {
                sleep(LATENCY_MS);
                throw new ExternalApiException("웹검색 후보 생성이 실패했습니다. (mock)", null);
            }
            case "slow" -> {
                sleep(SLOW_LATENCY_MS);
                return hit();
            }
            default -> {
                sleep(LATENCY_MS);
                return hit();
            }
        }
    }

    private List<WebSongCandidate> hit() {
        return List.of(
                // MockAcrMetadataClient 등록곡 — 메타 대조 성공 → verified
                new WebSongCandidate("좋은 날", List.of("아이유"), "Real", "Good Day", "IU", null),
                // mock 메타 미등록 — 미확인 라벨 + 웹 근거 링크 유지(신곡 케이스)
                new WebSongCandidate("밤편지", List.of("아이유"), "Palette", "Through the Night", "IU", "mockWebVid1"));
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
