package com.melolist.search.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.melolist.common.error.ExternalApiException;
import com.melolist.search.config.AcrCloudProperties;
import com.melolist.search.domain.SearchMode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

/**
 * ACRCloud identify API 실구현(지문/허밍 공용) — HMAC-SHA1 서명 방식.
 * 키·서명은 서버에만 존재한다(backend-prd §1).
 */
@Component
@Profile("!acr-mock")
@Slf4j
public class AcrCloudHttpClient implements AcrCloudClient {

    private static final String ENDPOINT = "/v1/identify";
    /** 결과 없음(1001) / 지문 생성 불가(2004) — 오류가 아니라 무결과(F2)로 처리. */
    private static final int CODE_OK = 0;
    private static final int CODE_NO_RESULT = 1001;
    private static final int CODE_CANNOT_FINGERPRINT = 2004;

    private final AcrCloudProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public AcrCloudHttpClient(AcrCloudProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.identifyTimeoutMs());
        factory.setReadTimeout(properties.identifyTimeoutMs());
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public List<AcrTrack> identify(byte[] audio, SearchMode mode) {
        AcrCloudProperties.Credentials creds = credentials(mode);
        long timestamp = Instant.now().getEpochSecond();
        String stringToSign = String.join("\n",
                "POST", ENDPOINT, creds.accessKey(), "audio", "1", String.valueOf(timestamp));
        String signature = hmacSha1Base64(stringToSign, creds.accessSecret());

        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("sample", new ByteArrayResource(audio) {
            @Override
            public String getFilename() {
                return "sample.wav";
            }
        });
        form.add("data_type", "audio");
        form.add("access_key", creds.accessKey());
        form.add("signature", signature);
        form.add("signature_version", "1");
        form.add("timestamp", String.valueOf(timestamp));
        form.add("sample_bytes", String.valueOf(audio.length));

        String body;
        try {
            body = restClient.post()
                    .uri("https://" + properties.identifyHost() + ENDPOINT)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(form)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException e) {
            throw new ExternalApiException("음악 인식 서비스 호출에 실패했습니다.", e);
        }

        return parse(body, mode);
    }

    private List<AcrTrack> parse(String body, SearchMode mode) {
        JsonNode root;
        try {
            root = objectMapper.readTree(body);
        } catch (Exception e) {
            throw new ExternalApiException("음악 인식 서비스 응답을 해석할 수 없습니다.", e);
        }

        int code = root.path("status").path("code").asInt(-1);
        if (code == CODE_NO_RESULT || code == CODE_CANNOT_FINGERPRINT) {
            return List.of();
        }
        if (code != CODE_OK) {
            log.error("ACRCloud identify 실패: code={}, msg={}", code, root.path("status").path("msg").asText());
            throw new ExternalApiException("음악 인식 서비스가 오류를 반환했습니다.", null);
        }

        List<AcrTrack> tracks = new ArrayList<>();
        for (JsonNode item : root.path("metadata").path(mode.acrMetadataKey())) {
            tracks.add(toTrack(item));
        }
        return tracks;
    }

    private AcrTrack toTrack(JsonNode item) {
        List<String> artists = new ArrayList<>();
        for (JsonNode artist : item.path("artists")) {
            String name = artist.path("name").asText(null);
            if (name != null && !name.isBlank()) {
                artists.add(name);
            }
        }
        return new AcrTrack(
                item.path("acrid").asText(null),
                item.path("title").asText(null),
                artists,
                item.path("album").path("name").asText(null),
                item.hasNonNull("release_date") ? item.path("release_date").asText() : null,
                item.hasNonNull("duration_ms") ? item.path("duration_ms").asInt() : null,
                item.path("score").asDouble(0)
        );
    }

    private AcrCloudProperties.Credentials credentials(SearchMode mode) {
        return mode == SearchMode.FINGERPRINT ? properties.fingerprint() : properties.humming();
    }

    private String hmacSha1Base64(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA1"));
            return Base64.getEncoder().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC-SHA1 서명 생성 실패", e);
        }
    }
}
