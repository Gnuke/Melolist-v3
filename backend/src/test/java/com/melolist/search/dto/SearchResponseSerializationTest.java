package com.melolist.search.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * TrackResult {@code verified} 필드 계약(spec 004 contracts §2) —
 * 심층 탐색 응답에만 존재하고, 기존 경로(fingerprint/humming/text)의 직렬화는 무변화.
 */
class SearchResponseSerializationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void 기존_9인자_경로는_verified_키_자체가_직렬화되지_않는다() throws Exception {
        SearchResponse.TrackResult legacy = new SearchResponse.TrackResult(
                "acr-123", "좋은 날", List.of(new SearchResponse.Artist("아이유")),
                null, null, null, "jeqdYqsrsA0",
                "https://www.youtube.com/watch?v=jeqdYqsrsA0", null);

        String json = mapper.writeValueAsString(legacy);

        assertThat(json).doesNotContain("verified");
        // 기존 계약: 다른 null 필드는 키가 유지된다(release_date 등)
        assertThat(json).contains("\"release_date\":null");
        assertThat(json).contains("\"score\":null");
    }

    @Test
    void 심층_탐색_후보는_verified_true_false가_명시된다() throws Exception {
        SearchResponse.TrackResult verified = new SearchResponse.TrackResult(
                "ai-0000000000000001", "확인된 곡", List.of(new SearchResponse.Artist("가수")),
                null, null, null, "dQw4w9WgXcQ",
                "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://cover", Boolean.TRUE);
        SearchResponse.TrackResult unverified = new SearchResponse.TrackResult(
                "ai-0000000000000002", "신곡", List.of(new SearchResponse.Artist("신인")),
                null, null, null, null, null, null, Boolean.FALSE);

        assertThat(mapper.writeValueAsString(verified)).contains("\"verified\":true");
        assertThat(mapper.writeValueAsString(unverified)).contains("\"verified\":false");
    }
}
