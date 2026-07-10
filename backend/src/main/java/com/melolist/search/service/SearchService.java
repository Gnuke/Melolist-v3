package com.melolist.search.service;

import com.melolist.event.service.EventService;
import com.melolist.music.domain.Music;
import com.melolist.music.dto.MusicResponse;
import com.melolist.music.dto.MusicUpsertCommand;
import com.melolist.music.service.MusicService;
import com.melolist.search.client.AcrCloudClient;
import com.melolist.search.client.AcrMetadataClient;
import com.melolist.search.client.AcrTrack;
import com.melolist.search.client.MetaEnrichment;
import com.melolist.search.domain.SearchHistory;
import com.melolist.search.domain.SearchMode;
import com.melolist.search.dto.SearchResponse;
import com.melolist.search.repository.SearchHistoryRepository;
import com.melolist.user.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * M2 검색 파이프라인(backend-prd §5.1).
 *
 * <pre>
 * 검증 → [acr_ms] identify → Top-3 → [meta_ms] 메타 보강(병렬, score≤0.5 생략)
 *  → [upsert_ms] MUSIC upsert → SearchHistory write(로그인 시) → search_request 기록 → 응답
 * </pre>
 *
 * 오디오 원본은 저장하지 않고 처리 후 즉시 폐기한다(§9-3).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    /** 메타 보강 생략 임계값(§5.3) — 허밍 저신뢰 결과는 Metadata API를 호출하지 않는다. */
    private static final double ENRICH_MIN_SCORE = 0.5;
    private static final int TOP_N = 3;

    private static final ExecutorService META_EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();

    private final AcrCloudClient acrCloudClient;
    private final AcrMetadataClient acrMetadataClient;
    private final MusicService musicService;
    private final UserService userService;
    private final EventService eventService;
    private final SearchHistoryRepository searchHistoryRepository;

    public SearchResponse search(SearchMode mode, MultipartFile audio, UUID sessionId, Jwt jwt) {
        byte[] bytes = readAndValidate(audio);
        UUID eventSessionId = sessionId != null ? sessionId : UUID.randomUUID();
        long t0 = System.nanoTime();

        List<AcrTrack> tracks = acrCloudClient.identify(bytes, mode);
        long acrMs = elapsedMs(t0);

        List<AcrTrack> top = dedupe(tracks).stream().limit(TOP_N).toList();
        if (top.isEmpty()) {
            recordHistory(jwt, mode, SearchHistory.Status.NO_MATCH, null, null);
            recordSearchRequest(eventSessionId, jwt, mode, bytes.length, false, elapsedMs(t0), acrMs, 0, 0);
            eventService.recordSilently("search_failed", eventSessionId, currentUserId(jwt),
                    Map.of("mode", mode.eventValue(), "reason", "no_match"));
            return SearchResponse.empty();
        }

        long metaStart = System.nanoTime();
        List<MetaEnrichment> enrichments = enrichInParallel(top, mode);
        long metaMs = elapsedMs(metaStart);

        long upsertStart = System.nanoTime();
        List<Music> musics = upsertAll(top, enrichments);
        long upsertMs = elapsedMs(upsertStart);

        Music topMusic = musics.isEmpty() ? null : musics.get(0);
        recordHistory(jwt, mode, SearchHistory.Status.MATCHED,
                topMusic == null ? null : topMusic.getId(), toScore(top.get(0).score()));
        recordSearchRequest(eventSessionId, jwt, mode, bytes.length, true, elapsedMs(t0), acrMs, metaMs, upsertMs);

        return buildResponse(top, enrichments);
    }

    /** 기본 검증(§5.1 t0) — 빈 파일·비오디오 MIME은 400. 크기 상한은 multipart 설정이 선차단. */
    private byte[] readAndValidate(MultipartFile audio) {
        if (audio == null || audio.isEmpty()) {
            throw new IllegalArgumentException("오디오 파일이 비어 있습니다.");
        }
        String contentType = audio.getContentType();
        if (contentType != null && !isAudioContentType(contentType)) {
            throw new IllegalArgumentException("오디오 형식이 아닙니다: " + contentType);
        }
        try {
            return audio.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("오디오 파일을 읽을 수 없습니다.");
        }
    }

    private boolean isAudioContentType(String contentType) {
        // 브라우저 MediaRecorder가 webm 컨테이너를 video/webm으로 보내는 경우가 있어 허용
        return contentType.startsWith("audio/")
                || contentType.equals("application/octet-stream")
                || contentType.equals("video/webm");
    }

    /** 제목+첫 아티스트 기준 중복 제거(v2 로직 계승). */
    private List<AcrTrack> dedupe(List<AcrTrack> tracks) {
        Set<String> seen = new HashSet<>();
        List<AcrTrack> unique = new ArrayList<>();
        for (AcrTrack t : tracks) {
            String key = t.title() + "-" + (t.firstArtist() == null ? "unknown" : t.firstArtist());
            if (seen.add(key)) {
                unique.add(t);
            }
        }
        return unique;
    }

    /** Top-3 메타 보강 병렬 실행(§5.3). score ≤ 0.5는 생략하고 EMPTY 유지. */
    private List<MetaEnrichment> enrichInParallel(List<AcrTrack> tracks, SearchMode mode) {
        List<CompletableFuture<MetaEnrichment>> futures = tracks.stream()
                .map(t -> t.score() > ENRICH_MIN_SCORE
                        ? CompletableFuture.supplyAsync(
                                () -> acrMetadataClient.lookup(t.title(), t.firstArtist(), mode), META_EXECUTOR)
                        : CompletableFuture.completedFuture(MetaEnrichment.EMPTY))
                .toList();
        return futures.stream()
                .map(f -> {
                    try {
                        return f.join();
                    } catch (Exception e) {
                        log.warn("메타 보강 병렬 실행 실패", e);
                        return MetaEnrichment.EMPTY;
                    }
                })
                .toList();
    }

    private List<Music> upsertAll(List<AcrTrack> tracks, List<MetaEnrichment> enrichments) {
        List<Music> musics = new ArrayList<>();
        for (int i = 0; i < tracks.size(); i++) {
            AcrTrack t = tracks.get(i);
            MetaEnrichment meta = enrichments.get(i);
            musics.add(musicService.upsertFromRecognition(new MusicUpsertCommand(
                    t.acrid(),
                    t.title(),
                    t.artists().isEmpty() ? null : String.join(", ", t.artists()),
                    t.album(),
                    parseReleaseDate(t.releaseDate()),
                    t.durationMs(),
                    meta.youtubeVideoId(),
                    resolveCoverUrl(meta)
            )));
        }
        return musics;
    }

    /** 커버 3단 폴백(§5.2): album.covers.medium → ytimg → null. */
    private String resolveCoverUrl(MetaEnrichment meta) {
        if (meta.coverUrl() != null) {
            return meta.coverUrl();
        }
        if (meta.youtubeVideoId() != null) {
            return "https://i.ytimg.com/vi/" + meta.youtubeVideoId() + "/mqdefault.jpg";
        }
        return null;
    }

    private SearchResponse buildResponse(List<AcrTrack> tracks, List<MetaEnrichment> enrichments) {
        List<SearchResponse.TrackResult> results = new ArrayList<>();
        for (int i = 0; i < tracks.size(); i++) {
            AcrTrack t = tracks.get(i);
            MetaEnrichment meta = enrichments.get(i);
            results.add(new SearchResponse.TrackResult(
                    t.acrid(),
                    t.title(),
                    t.artists().stream().map(SearchResponse.Artist::new).toList(),
                    t.album() == null ? null : new SearchResponse.Album(t.album()),
                    t.releaseDate(),
                    t.score(),
                    meta.youtubeVideoId(),
                    MusicResponse.toYoutubeUrl(meta.youtubeVideoId()),
                    resolveCoverUrl(meta)
            ));
        }
        return new SearchResponse(results);
    }

    /**
     * 검색 기록 write(M2는 write만, 조회는 M3 — C4). 로그인 사용자 한정이며
     * 실패해도 검색 응답에 영향을 주지 않는다(§5.1).
     */
    private void recordHistory(Jwt jwt, SearchMode mode, SearchHistory.Status status,
                               Long topMusicId, BigDecimal score) {
        if (jwt == null) {
            return;
        }
        try {
            // 프로필 JIT 보장 — 로그인 직후 /users/me 호출 전에 검색해도 FK가 깨지지 않게
            userService.getOrProvision(jwt);
            searchHistoryRepository.save(new SearchHistory(
                    UUID.fromString(jwt.getSubject()),
                    SearchHistory.Type.valueOf(mode.name()),
                    status,
                    topMusicId,
                    score
            ));
        } catch (Exception e) {
            log.warn("검색 기록 저장 실패", e);
        }
    }

    /** 요청당 구간별 타이밍 레코드(C5, KR2 원천) — event_log에 search_request로 기록. */
    private void recordSearchRequest(UUID sessionId, Jwt jwt, SearchMode mode, int audioBytes,
                                     boolean matched, long totalMs, long acrMs, long metaMs, long upsertMs) {
        Map<String, Object> props = new HashMap<>();
        props.put("total_ms", totalMs);
        props.put("acr_ms", acrMs);
        props.put("meta_ms", metaMs);
        props.put("upsert_ms", upsertMs);
        props.put("audio_bytes", audioBytes);
        props.put("mode", mode.eventValue());
        props.put("matched", matched);
        eventService.recordSilently("search_request", sessionId, currentUserId(jwt), props);
    }

    private UUID currentUserId(Jwt jwt) {
        return jwt == null ? null : UUID.fromString(jwt.getSubject());
    }

    private BigDecimal toScore(double score) {
        return BigDecimal.valueOf(score).setScale(2, RoundingMode.HALF_UP);
    }

    private LocalDate parseReleaseDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(raw);
        } catch (Exception e) {
            // "2014" 같은 부분 날짜는 버린다 — DTO에는 원문이 그대로 나간다
            return null;
        }
    }

    private long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}
