package com.melolist.search.client;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.melolist.search.config.AiProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * OpenAI Responses API + web_search 도구 기반 심층 곡 탐색(spec 004 R1·R2).
 * Spring AI 1.1.8은 Chat Completions 기반이라 web_search를 못 써 RestClient로 직접
 * 호출한다. 키·모델은 기존 {@code spring.ai.openai.*} 값을 재사용(서버 전용, 원칙 IV).
 *
 * <p>tool_choice는 auto — 옛 곡(모델이 아는 곡)은 미발동(3~4s·~3원), 모르는 곡만
 * 발동(19~21.5s·~80~110원)해 비용을 아낀다. 발동 유도는 프롬프트 규칙으로.</p>
 */
@Component
@Profile("!ai-mock")
@Slf4j
public class OpenAiWebSongFinderClient implements WebSongFinderClient {

    private static final String SYSTEM_PROMPT = """
            너는 곡 식별 도우미다. 사용자가 기억하는 조각(가사 일부, 분위기, 들었던 상황, 시기, 장르)을
            바탕으로 실제로 존재하는 곡을 찾아준다. 이 요청은 일반 검색이 실패한 뒤의 심층 탐색이다.
            규칙:
            1. 실존하는 곡만 후보로 낸다. 곡을 지어내지 않는다.
            2. 학습 지식만으로 확신할 수 없는 곡(최근 발매곡·희귀곡·신인 아티스트)은 반드시 웹 검색으로
               실존과 표기를 확인한다. 단서가 최신 곡을 가리키면 웹 검색 없이 답하지 않는다.
            3. 후보는 최대 5곡, 사용자가 찾는 곡일 가능성이 높은 순서로 정렬한다.
            4. 단서와 맞는 실존 곡을 하나도 찾을 수 없을 때만 빈 목록을 반환한다.
            5. title은 공식 곡명, artists는 아티스트 이름 배열, album은 모르면 null.
            6. titleAlt·artistAlt에는 해외 스트리밍/유튜브 카탈로그에 등재되는 공식 영문(로마자)
               표기를 넣는다(예: 흔적→Trace, 윤종신→Yoon Jong Shin). 원표기가 이미
               영문이거나 모르면 null.
            7. youtubeUrl에는 웹 검색으로 확인한 그 곡의 유튜브 링크(URL)를 넣는다.
               확인하지 못했으면 null — 링크를 추측해서 만들지 않는다.
            """;

    /** 진단 로그의 원응답 길이 상한 — 로그 폭주 방지. */
    private static final int RAW_LOG_LIMIT = 2000;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final BeanOutputConverter<WebCandidateList> CONVERTER =
            new BeanOutputConverter<>(WebCandidateList.class);

    private final RestClient restClient;
    private final String model;
    private final AiProperties aiProperties;

    public OpenAiWebSongFinderClient(RestClient.Builder restClientBuilder,
                                     @Value("${spring.ai.openai.api-key}") String apiKey,
                                     @Value("${spring.ai.openai.chat.options.model:gpt-5.4-mini}") String model,
                                     AiProperties aiProperties) {
        this.restClient = restClientBuilder
                .baseUrl("https://api.openai.com")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .build();
        this.model = model;
        this.aiProperties = aiProperties;
    }

    /** LLM 출력 스키마 루트 — youtubeUrl은 서버가 videoId로 추출·검증한다(R5). */
    record WebCandidateList(List<Item> candidates) {
    }

    record Item(String title, List<String> artists, String album,
                String titleAlt, String artistAlt, String youtubeUrl) {
    }

    @Override
    public List<WebSongCandidate> findCandidates(String query) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        String effort = aiProperties.reasoningEffort();
        if (effort != null && !effort.isBlank() && !"none".equalsIgnoreCase(effort)) {
            body.put("reasoning", Map.of("effort", effort));
        }
        body.put("tools", List.of(Map.of("type", "web_search")));
        body.put("instructions", SYSTEM_PROMPT);
        body.put("input", query + "\n\n" + CONVERTER.getFormat());

        String responseBody = restClient.post()
                .uri("/v1/responses")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);

        String text = extractOutputText(responseBody);
        if (text == null || text.isBlank()) {
            log.warn("웹검색 후보 응답에 output_text 없음(생성 자체 없음)");
            return List.of();
        }

        WebCandidateList out;
        try {
            out = CONVERTER.convert(text);
        } catch (RuntimeException e) {
            // 파싱 실패는 empty로 위장하지 않는다 — 상위에서 outcome=error(502)로 구분(002 정책)
            log.warn("웹검색 후보 응답 파싱 실패 — raw={}", truncate(text), e);
            throw e;
        }

        List<Item> items = out == null || out.candidates() == null ? List.of() : out.candidates();
        if (items.isEmpty()) {
            log.info("웹검색 후보 0건 — raw={}", truncate(text));
        }
        return items.stream()
                .map(i -> new WebSongCandidate(i.title(), i.artists(), i.album(),
                        i.titleAlt(), i.artistAlt(), YoutubeLinks.extractVideoId(i.youtubeUrl())))
                .toList();
    }

    /** Responses API output[]에서 message/output_text만 이어 붙인다(web_search_call 항목은 무시). */
    static String extractOutputText(String responseBody) {
        JsonNode root;
        try {
            root = MAPPER.readTree(responseBody);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Responses API 응답을 해석할 수 없습니다.", e);
        }
        StringBuilder sb = new StringBuilder();
        for (JsonNode item : root.path("output")) {
            if (!"message".equals(item.path("type").asText())) {
                continue;
            }
            for (JsonNode content : item.path("content")) {
                if ("output_text".equals(content.path("type").asText())) {
                    sb.append(content.path("text").asText());
                }
            }
        }
        return sb.toString();
    }

    private static String truncate(String s) {
        return s.length() <= RAW_LOG_LIMIT ? s : s.substring(0, RAW_LOG_LIMIT) + "…(truncated)";
    }
}
