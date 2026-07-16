package com.melolist.search.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.melolist.search.config.AcrCloudProperties;
import com.melolist.search.domain.SearchMode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.Set;

/**
 * ACRCloud Metadata API 실구현 — 커버·유튜브 videoId 보강 전담.
 *
 * <p>추출 규칙(backend-prd §5.2): cover는 최상위 {@code album.covers.medium}만,
 * external_metadata에서는 {@code youtube[].id}만 읽는다(도메인 검증 포함).
 * applemusic/deezer/spotify 배열은 파싱하지 않고 preview는 읽지도 저장하지도 않는다(§9).</p>
 */
@Component
@Profile("!acr-mock")
@Slf4j
public class AcrMetadataHttpClient implements AcrMetadataClient {

    private static final String ENDPOINT = "/api/external-metadata/tracks";
    private static final Set<String> YOUTUBE_HOSTS = Set.of(
            "www.youtube.com", "youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be");

    private final AcrCloudProperties properties;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public AcrMetadataHttpClient(AcrCloudProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.metadataTimeoutMs());
        factory.setReadTimeout(properties.metadataTimeoutMs());
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    @Override
    public MetaEnrichment lookup(String track, String artist, SearchMode mode) {
        String token = mode == SearchMode.FINGERPRINT
                ? properties.fingerprint().metadataToken()
                : properties.humming().metadataToken();
        if (token.isBlank() || track == null || track.isBlank()) {
            return MetaEnrichment.EMPTY;
        }

        try {
            String queryJson = buildQueryJson(track, artist);
            URI uri = UriComponentsBuilder
                    .fromUriString("https://" + properties.metadataHost() + ENDPOINT)
                    .queryParam("query", "{query}")
                    .queryParam("format", "json")
                    .queryParam("platforms", "youtube")
                    .build(queryJson);

            String body = restClient.get()
                    .uri(uri)
                    .header("Authorization", "Bearer " + token)
                    .retrieve()
                    .body(String.class);

            return parse(body);
        } catch (Exception e) {
            log.warn("Metadata API 보강 실패(track={}): {}", track, e.getMessage());
            return MetaEnrichment.EMPTY;
        }
    }

    private String buildQueryJson(String track, String artist) throws Exception {
        var query = objectMapper.createObjectNode();
        query.put("track", cleanQueryText(track));
        if (artist != null && !artist.isBlank()) {
            // 복수 표기는 콤마 분리 후 첫 아티스트만 사용.
            // artists는 반드시 배열로 — 문자열이면 API가 대부분 data:[]를 반환한다(실측 2026-07-16)
            String first = cleanQueryText(artist.split(",")[0]);
            if (!first.isBlank()) {
                query.putArray("artists").add(first);
            }
        }
        return objectMapper.writeValueAsString(query);
    }

    /** 괄호(...) 내용 제거 — 리믹스/피처링 표기가 매칭을 방해하는 것 방지(v2 로직 계승). */
    private String cleanQueryText(String text) {
        return text.replaceAll("\\(.*?\\)", "").trim();
    }

    private MetaEnrichment parse(String body) throws Exception {
        JsonNode first = objectMapper.readTree(body).path("data").path(0);
        if (first.isMissingNode()) {
            return MetaEnrichment.EMPTY;
        }

        String videoId = extractYoutubeVideoId(first.path("external_metadata").path("youtube").path(0));
        String coverUrl = first.path("album").path("covers").path("medium").asText(null);
        if (coverUrl != null && coverUrl.isBlank()) {
            coverUrl = null;
        }
        return new MetaEnrichment(videoId, coverUrl);
    }

    /** {@code youtube[].id}만 읽되, link가 있으면 유튜브 계열 도메인인지 검증한다(§7.1-5 오염 대비). */
    private String extractYoutubeVideoId(JsonNode youtube) {
        String id = youtube.path("id").asText(null);
        if (id == null || id.isBlank()) {
            return null;
        }
        String link = youtube.path("link").asText(null);
        if (link != null && !isYoutubeLink(link)) {
            log.warn("external_metadata.youtube link 도메인 검증 실패: {}", link);
            return null;
        }
        return id;
    }

    private boolean isYoutubeLink(String link) {
        try {
            String host = URI.create(link).getHost();
            return host != null && YOUTUBE_HOSTS.contains(host.toLowerCase());
        } catch (Exception e) {
            return false;
        }
    }
}
