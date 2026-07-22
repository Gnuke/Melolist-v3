package com.melolist.search.client.mock;

import com.melolist.common.error.ExternalApiException;
import com.melolist.search.client.AiSongCandidate;
import com.melolist.search.client.AiSongFinderClient;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * AI 곡 후보 식별 목업 — {@code ai-mock} 프로파일 전용(spec 002, R9).
 * OpenAI 실호출 없이(비용 0) 폴백 흐름 전체(후보→메타 보강→선택→저장)를 검증한다.
 * 로컬 E2E는 {@code SPRING_PROFILES_ACTIVE=acr-mock,ai-mock} 병행 활성화 —
 * 좋은 날/Ditto는 MockAcrMetadataClient가 보강하고, 밤편지는 미등록이라 링크 null 케이스.
 *
 * <p>시나리오 전환: 환경변수 {@code AI_MOCK_SCENARIO} = hit | empty | error | slow (기본 hit).
 * slow는 12s 지연으로 서비스 10s 컷(502)을 검증한다.</p>
 */
@Component
@Profile("ai-mock")
@Slf4j
public class MockAiSongFinderClient implements AiSongFinderClient {

    /** ai_ms 타이밍이 그럴듯하게 나오도록 실측 흉내 지연. */
    private static final long LATENCY_MS = 800;
    private static final long SLOW_LATENCY_MS = 12_000;

    private final String scenario;

    public MockAiSongFinderClient(@Value("${melolist.ai.mock.scenario:hit}") String scenario) {
        this.scenario = scenario;
        log.warn("★ AI 폴백 MOCK 활성(ai-mock 프로파일) — scenario={} (실호출 없음)", scenario);
    }

    @Override
    public List<AiSongCandidate> findCandidates(String query) {
        switch (scenario) {
            case "empty" -> {
                sleep(LATENCY_MS);
                return List.of();
            }
            case "error" -> {
                sleep(LATENCY_MS);
                throw new ExternalApiException("AI 후보 생성이 실패했습니다. (mock)", null);
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

    private List<AiSongCandidate> hit() {
        return List.of(
                new AiSongCandidate("좋은 날", List.of("아이유"), "Real"),
                new AiSongCandidate("Ditto", List.of("NewJeans"), "OMG"),
                new AiSongCandidate("밤편지", List.of("아이유"), "Palette")
        );
    }

    private void sleep(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
