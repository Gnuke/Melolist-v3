package com.melolist.search.client.mock;

import com.melolist.common.error.ExternalApiException;
import com.melolist.search.client.AcrCloudClient;
import com.melolist.search.client.AcrTrack;
import com.melolist.search.domain.SearchMode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * ACRCloud identify 목업 — {@code acr-mock} 프로파일 전용(개발/파이프라인 테스트).
 * 실호출 없이(쿼터 소모 0) 검증→Top-3→보강→upsert→계측 전체 파이프라인을 돌려본다.
 * 프론트 목업(frontend/src/mock/searchMock.ts)과 같은 곡·같은 시나리오 체계.
 *
 * <p>시나리오 전환: 환경변수 {@code ACR_MOCK_SCENARIO} = hit | nomatch | lowscore | error
 * (기본 hit). 점수 스케일은 실제와 동일 — 지문 0~100, 허밍 0~1.</p>
 */
@Component
@Profile("acr-mock")
@Slf4j
public class MockAcrCloudClient implements AcrCloudClient {

    /** 타이밍 로그(acr_ms)가 그럴듯하게 나오도록 실측 흉내 지연. */
    private static final long LATENCY_MS = 400;

    static final AcrTrack GOOD_DAY =
            new AcrTrack("mock-good-day", "좋은 날", List.of("아이유"), "Real", "2010-12-09", 235000, 100);
    static final AcrTrack DITTO =
            new AcrTrack("mock-ditto", "Ditto", List.of("NewJeans"), "OMG", "2022-12-19", 185000, 92);
    static final AcrTrack DYNAMITE =
            new AcrTrack("mock-dynamite", "Dynamite", List.of("BTS"), "Dynamite (DayTime Version)", "2020-08-21", 199000, 85);
    static final AcrTrack NO_MEDIA =
            new AcrTrack("mock-no-media", "이름 모를 인디곡", List.of("미상 아티스트"), "Demo", "2019-03-01", 172000, 0.58);

    private final String scenario;

    public MockAcrCloudClient(@Value("${melolist.acrcloud.mock.scenario:hit}") String scenario) {
        this.scenario = scenario;
        log.warn("★ ACRCloud MOCK 활성(acr-mock 프로파일) — scenario={} (실호출 없음)", scenario);
    }

    @Override
    public List<AcrTrack> identify(byte[] audio, SearchMode mode) {
        sleep();
        return switch (scenario) {
            case "nomatch" -> List.of();
            case "error" -> throw new ExternalApiException("음악 인식 서비스가 오류를 반환했습니다. (mock)", null);
            case "lowscore" -> mode == SearchMode.HUMMING
                    // 전부 score≤0.5 → 보강 생략(F3 저신뢰). 지문엔 저신뢰 개념 없음 → hit과 동일
                    ? List.of(withScore(DYNAMITE, 0.43), withScore(DITTO, 0.31))
                    : hit(mode);
            default -> hit(mode);
        };
    }

    private List<AcrTrack> hit(SearchMode mode) {
        if (mode == SearchMode.HUMMING) {
            return List.of(withScore(GOOD_DAY, 0.92), withScore(DITTO, 0.71), NO_MEDIA);
        }
        return List.of(GOOD_DAY, DITTO, DYNAMITE);
    }

    private AcrTrack withScore(AcrTrack t, double score) {
        return new AcrTrack(t.acrid(), t.title(), t.artists(), t.album(), t.releaseDate(), t.durationMs(), score);
    }

    private void sleep() {
        try {
            Thread.sleep(LATENCY_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
