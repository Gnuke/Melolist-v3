package com.melolist.search.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.melolist.common.error.ExternalApiException;
import com.melolist.search.config.AcrCloudProperties;
import com.melolist.search.domain.SearchMode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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

        // multipart 바디를 직접 조립한다. Spring FormHttpMessageConverter는 Content-Type에
        // charset=UTF-8 파라미터를 붙이는데, ACRCloud가 이를 3002(Invalid http content type)로
        // 거부한다(2026-07-10 실측). curl과 동일한 형식으로 보내기 위한 우회.
        String boundary = "melolist-" + UUID.randomUUID();
        byte[] body = buildMultipartBody(boundary, audio, Map.of(
                "data_type", "audio",
                "access_key", creds.accessKey(),
                "signature", signature,
                "signature_version", "1",
                "timestamp", String.valueOf(timestamp),
                "sample_bytes", String.valueOf(audio.length)
        ));

        String response;
        try {
            response = restClient.post()
                    .uri("https://" + properties.identifyHost() + ENDPOINT)
                    .header(HttpHeaders.CONTENT_TYPE, "multipart/form-data; boundary=" + boundary)
                    .body(body)
                    .retrieve()
                    .body(String.class);
        } catch (RestClientException e) {
            throw new ExternalApiException("음악 인식 서비스 호출에 실패했습니다.", e);
        }

        return parse(response, mode);
    }

    private byte[] buildMultipartBody(String boundary, byte[] audio, Map<String, String> fields) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream(audio.length + 1024);
            for (Map.Entry<String, String> field : fields.entrySet()) {
                out.write(("--" + boundary + "\r\n"
                        + "Content-Disposition: form-data; name=\"" + field.getKey() + "\"\r\n\r\n"
                        + field.getValue() + "\r\n").getBytes(StandardCharsets.UTF_8));
            }
            out.write(("--" + boundary + "\r\n"
                    + "Content-Disposition: form-data; name=\"sample\"; filename=\"sample.wav\"\r\n"
                    + "Content-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.UTF_8));
            out.write(audio);
            out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("multipart 바디 생성 실패", e);
        }
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
