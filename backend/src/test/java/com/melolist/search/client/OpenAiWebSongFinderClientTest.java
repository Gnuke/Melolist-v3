package com.melolist.search.client;

import com.melolist.search.config.AiProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * Responses API 직접 호출 클라이언트(spec 004 R1·R2) — web_search 도구 요청 형태와
 * 응답 파싱(output_text 추출 → 후보 JSON → videoId 정규화)을 검증한다. 실호출 없음.
 */
class OpenAiWebSongFinderClientTest {

    private MockRestServiceServer server;
    private OpenAiWebSongFinderClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        client = new OpenAiWebSongFinderClient(builder, "test-key", "gpt-5.4-mini",
                new AiProperties(10_000, "low", 8_000, new AiProperties.Quota(3, 10)));
    }

    private static String responseWith(String outputText) {
        return """
                {
                  "id": "resp_123",
                  "output": [
                    {"type": "web_search_call", "id": "ws_1", "status": "completed"},
                    {"type": "message", "role": "assistant", "content": [
                      {"type": "output_text", "text": %s}
                    ]}
                  ]
                }
                """.formatted(quote(outputText));
    }

    private static String quote(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\"";
    }

    @Test
    void web_search_도구를_요청에_싣고_후보의_웹_링크를_videoId로_정규화한다() {
        server.expect(requestTo("https://api.openai.com/v1/responses"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Authorization", "Bearer test-key"))
                .andExpect(jsonPath("$.model").value("gpt-5.4-mini"))
                .andExpect(jsonPath("$.tools[0].type").value("web_search"))
                .andExpect(jsonPath("$.reasoning.effort").value("low"))
                .andRespond(withSuccess(responseWith(
                        "{\"candidates\":[{\"title\":\"신곡\",\"artists\":[\"신인\"],\"album\":null,"
                                + "\"titleAlt\":null,\"artistAlt\":null,"
                                + "\"youtubeUrl\":\"https://www.youtube.com/watch?v=dQw4w9WgXcQ\"}]}"),
                        MediaType.APPLICATION_JSON));

        List<WebSongCandidate> candidates = client.findCandidates("이번 달에 나온 노래");

        assertThat(candidates).hasSize(1);
        assertThat(candidates.get(0).title()).isEqualTo("신곡");
        assertThat(candidates.get(0).artists()).containsExactly("신인");
        assertThat(candidates.get(0).youtubeVideoId()).isEqualTo("dQw4w9WgXcQ");
        server.verify();
    }

    @Test
    void 비유튜브_링크는_검증에서_떨어져_null이_된다() {
        server.expect(requestTo("https://api.openai.com/v1/responses"))
                .andRespond(withSuccess(responseWith(
                        "{\"candidates\":[{\"title\":\"신곡\",\"artists\":[\"신인\"],\"album\":null,"
                                + "\"titleAlt\":null,\"artistAlt\":null,"
                                + "\"youtubeUrl\":\"https://evil.example.com/watch?v=dQw4w9WgXcQ\"}]}"),
                        MediaType.APPLICATION_JSON));

        List<WebSongCandidate> candidates = client.findCandidates("아무 설명");

        assertThat(candidates).hasSize(1);
        assertThat(candidates.get(0).youtubeVideoId()).isNull();
    }

    @Test
    void 출력_텍스트가_없으면_기권으로_보고_빈_목록을_반환한다() {
        server.expect(requestTo("https://api.openai.com/v1/responses"))
                .andRespond(withSuccess("""
                        {"id": "resp_124", "output": [
                          {"type": "web_search_call", "id": "ws_1", "status": "completed"}
                        ]}
                        """, MediaType.APPLICATION_JSON));

        assertThat(client.findCandidates("아무 설명")).isEmpty();
    }

    @Test
    void 빈_후보_목록은_기권이다() {
        server.expect(requestTo("https://api.openai.com/v1/responses"))
                .andRespond(withSuccess(responseWith("{\"candidates\":[]}"), MediaType.APPLICATION_JSON));

        assertThat(client.findCandidates("존재하지 않는 곡")).isEmpty();
    }

    @Test
    void 스키마_밖_응답은_예외로_전파된다() {
        // empty로 위장하지 않는다 — 상위에서 outcome=error(502)로 구분(002와 동일 정책)
        server.expect(requestTo("https://api.openai.com/v1/responses"))
                .andRespond(withSuccess(responseWith("후보를 찾을 수 없었습니다"), MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.findCandidates("아무 설명"))
                .isInstanceOf(RuntimeException.class);
    }
}
