package com.melolist.search.client.mock;

import com.melolist.search.client.AcrMetadataClient;
import com.melolist.search.client.MetaEnrichment;
import com.melolist.search.domain.SearchMode;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * Metadata API 목업 — {@code acr-mock} 프로파일 전용.
 * 커버 3단 폴백(§5.2)을 전부 시연하도록 구성:
 * 좋은 날 = 커버 있음(1순위) · Ditto/Dynamite = videoId만(→ ytimg 2순위 폴백) ·
 * 그 외(인디곡) = 둘 다 없음(→ 프론트 플레이스홀더 3순위).
 */
@Component
@Profile("acr-mock")
public class MockAcrMetadataClient implements AcrMetadataClient {

    private static final long LATENCY_MS = 200;

    private static final Map<String, MetaEnrichment> BY_TITLE = Map.of(
            "좋은 날", new MetaEnrichment("jeqdYqsrsA0", "https://i.ytimg.com/vi/jeqdYqsrsA0/mqdefault.jpg"),
            "Ditto", new MetaEnrichment("pSUydWEqKwE", null),
            "Dynamite", new MetaEnrichment("gdZLi9oWNZg", null)
    );

    @Override
    public MetaEnrichment lookup(String track, String artist, SearchMode mode) {
        try {
            Thread.sleep(LATENCY_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return BY_TITLE.getOrDefault(track, MetaEnrichment.EMPTY);
    }
}
