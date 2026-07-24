package com.melolist.search.client;

import com.melolist.search.config.AiProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Spring AI ChatClient 기반 곡 후보 식별(spec 002, R1·R2).
 * 모델·키는 {@code spring.ai.openai.*} 바인딩(기본 gpt-5.4-mini, env 교체 가능).
 * 구조화 출력은 entity() 대신 수동 변환한다 — 후보 0건이 "모델 기권"인지
 * "응답 형태가 스키마에 안 붙은 것"인지 원응답 로그로 구분하기 위함(둘 다 겉으론 empty).
 */
@Component
@Profile("!ai-mock")
@Slf4j
public class OpenAiSongFinderClient implements AiSongFinderClient {

    private static final String SYSTEM_PROMPT = """
            너는 곡 식별 도우미다. 사용자가 기억하는 조각(가사 일부, 분위기, 들었던 상황, 시기, 장르)을
            바탕으로 실제로 존재하는 곡을 찾아준다.
            규칙:
            1. 실존하는 곡만 후보로 낸다. 곡을 지어내지 않는다. 제목·아티스트 조합이 실제
               발매작이라는 확신이 없으면 그 후보는 목록에서 제외한다.
            2. 후보는 최대 5곡, 사용자가 찾는 곡일 가능성이 높은 순서로 정렬한다.
            3. 단서가 모호해도 실존이 확실한 곡 중에서 가능성 있는 후보를 낸다 — "사용자가 찾는
               바로 그 곡"이라는 확신이 낮은 것은 기권 사유가 아니다(순위로 표현한다).
            4. 단서와 맞는 실존 곡을 하나도 떠올릴 수 없을 때만 빈 목록을 반환한다.
            5. title은 공식 곡명, artists는 아티스트 이름 배열, album은 모르면 null.
            """;

    /** 진단 로그의 원응답 길이 상한 — 로그 폭주 방지. */
    private static final int RAW_LOG_LIMIT = 2000;

    private static final BeanOutputConverter<CandidateList> CONVERTER =
            new BeanOutputConverter<>(CandidateList.class);

    private final ChatClient chatClient;
    private final AiProperties aiProperties;

    public OpenAiSongFinderClient(ChatClient.Builder chatClientBuilder, AiProperties aiProperties) {
        this.chatClient = chatClientBuilder.build();
        this.aiProperties = aiProperties;
    }

    /** 변환 대상 — LLM 출력 스키마의 루트(기존 entity() 바인딩과 동일 스키마). */
    record CandidateList(List<AiSongCandidate> candidates) {
    }

    @Override
    public List<AiSongCandidate> findCandidates(String query) {
        // entity()가 내부에서 하던 것과 동일하게 포맷 지시를 사용자 메시지 뒤에 붙인다
        ChatClient.ChatClientRequestSpec spec = chatClient.prompt()
                .system(SYSTEM_PROMPT)
                .user(query + "\n\n" + CONVERTER.getFormat());
        String effort = aiProperties.reasoningEffort();
        if (effort != null && !effort.isBlank() && !"none".equalsIgnoreCase(effort)) {
            // gpt-5 계열: 곡 식별은 지식 인출 작업 — 추론 최소화로 지연을 줄인다(R1)
            spec = spec.options(OpenAiChatOptions.builder().reasoningEffort(effort).build());
        }

        ChatResponse chat = spec.call().chatResponse();
        String raw = chat == null || chat.getResult() == null || chat.getResult().getOutput() == null
                ? null
                : chat.getResult().getOutput().getText();
        if (raw == null || raw.isBlank()) {
            log.warn("AI 후보 응답이 비어 있음(생성 자체 없음) — finishReason={}",
                    chat == null || chat.getResult() == null ? "no-result" : chat.getResult().getMetadata());
            return List.of();
        }

        CandidateList out;
        try {
            out = CONVERTER.convert(raw);
        } catch (RuntimeException e) {
            // 파싱 실패는 empty로 위장하지 않는다 — 상위에서 outcome=error(502)로 구분됨
            log.warn("AI 후보 응답 파싱 실패 — raw={}", truncate(raw), e);
            throw e;
        }

        List<AiSongCandidate> candidates = out == null || out.candidates() == null
                ? List.of()
                : out.candidates();
        if (candidates.isEmpty()) {
            // 기권(빈 목록)인지 스키마 미스매치(candidates 누락)인지 원응답으로 판별
            log.info("AI 후보 0건 — raw={}", truncate(raw));
        }
        return candidates;
    }

    private static String truncate(String s) {
        return s.length() <= RAW_LOG_LIMIT ? s : s.substring(0, RAW_LOG_LIMIT) + "…(truncated)";
    }
}
