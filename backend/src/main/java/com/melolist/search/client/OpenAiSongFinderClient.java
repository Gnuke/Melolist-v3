package com.melolist.search.client;

import com.melolist.search.config.AiProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Spring AI ChatClient 기반 곡 후보 식별(spec 002, R1·R2).
 * 모델·키는 {@code spring.ai.openai.*} 바인딩(기본 gpt-5-mini, env 교체 가능).
 * 구조화 출력(entity 바인딩)으로 JSON 파싱을 Spring AI에 위임한다.
 */
@Component
@Profile("!ai-mock")
@Slf4j
public class OpenAiSongFinderClient implements AiSongFinderClient {

    private static final String SYSTEM_PROMPT = """
            너는 곡 식별 도우미다. 사용자가 기억하는 조각(가사 일부, 분위기, 들었던 상황, 시기, 장르)을
            바탕으로 실제로 존재하는 곡을 찾아준다.
            규칙:
            1. 실존을 확신할 수 있는 곡만 후보로 낸다. 곡을 지어내지 않는다.
            2. 후보는 최대 5곡, 사용자가 찾는 곡일 가능성이 높은 순서로 정렬한다.
            3. 확실한 후보가 없으면 빈 목록을 반환한다.
            4. title은 공식 곡명, artists는 아티스트 이름 배열, album은 모르면 null.
            """;

    private final ChatClient chatClient;
    private final AiProperties aiProperties;

    public OpenAiSongFinderClient(ChatClient.Builder chatClientBuilder, AiProperties aiProperties) {
        this.chatClient = chatClientBuilder.build();
        this.aiProperties = aiProperties;
    }

    /** entity 바인딩 대상 — LLM 출력 스키마의 루트. */
    record CandidateList(List<AiSongCandidate> candidates) {
    }

    @Override
    public List<AiSongCandidate> findCandidates(String query) {
        ChatClient.ChatClientRequestSpec spec = chatClient.prompt()
                .system(SYSTEM_PROMPT)
                .user(query);
        String effort = aiProperties.reasoningEffort();
        if (effort != null && !effort.isBlank() && !"none".equalsIgnoreCase(effort)) {
            // gpt-5 계열: 곡 식별은 지식 인출 작업 — 추론 최소화로 지연을 줄인다(R1)
            spec = spec.options(OpenAiChatOptions.builder().reasoningEffort(effort).build());
        }
        CandidateList out = spec.call().entity(CandidateList.class);
        return out == null || out.candidates() == null ? List.of() : out.candidates();
    }
}
