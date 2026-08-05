package com.melolist.search.service;

import com.melolist.common.error.AiQuotaExceededException;
import com.melolist.common.error.ExternalApiException;
import com.melolist.event.service.EventService;
import com.melolist.music.domain.Music;
import com.melolist.music.dto.MusicResponse;
import com.melolist.music.dto.MusicUpsertCommand;
import com.melolist.music.service.MusicService;
import com.melolist.search.client.AcrMetadataClient;
import com.melolist.search.client.MetaEnrichment;
import com.melolist.search.client.WebSongCandidate;
import com.melolist.search.client.WebSongFinderClient;
import com.melolist.search.config.AiProperties;
import com.melolist.search.config.DeepSearchProperties;
import com.melolist.search.domain.SearchHistory;
import com.melolist.search.domain.SearchMode;
import com.melolist.search.dto.DeepSelectRequest;
import com.melolist.search.dto.SearchResponse;
import com.melolist.search.repository.SearchHistoryRepository;
import com.melolist.user.service.UserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * 웹검색 심층 탐색(spec 004) — AI 폴백의 에스컬레이션 티어. 로그인 전용.
 *
 * <pre>
 * deep 쿼터(2회/일) → [web_ms] 웹검색 후보 식별(1회 호출·22s 컷)
 *   → [meta_ms] 메타 대조(병렬·8s 데드라인) — 필터가 아닌 verified 라벨(FR-005)
 *   → 응답(저장 없음) → (선택 시) select: upsert(source=WEB) + 기록(DEEP) + 계측
 * </pre>
 *
 * 002와의 핵심 차이: ①대조 실패 후보를 제외하지 않고 미확인으로 노출(신곡 오살 방지)
 * ②미확인 후보는 웹 근거 videoId를 표시·저장에 사용 ③샘플링 1회(발동 시 회당
 * ~80~110원 — R7) ④쿼터는 사용자 원장 단독(R6).
 */
@Service
@Slf4j
public class DeepSearchService {

    private static final int MAX_CANDIDATES = 5;
    /** 메타 보강 토큰은 지문(music) 프로젝트 것을 쓴다 — 002와 동일. */
    private static final SearchMode META_LOOKUP_MODE = SearchMode.FINGERPRINT;

    private static final ExecutorService PIPELINE_EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();

    private final WebSongFinderClient webSongFinderClient;
    private final AiQuotaService aiQuotaService;
    private final AiProperties aiProperties;
    private final DeepSearchProperties deepProperties;
    private final MusicService musicService;
    private final UserService userService;
    private final EventService eventService;
    private final SearchHistoryRepository searchHistoryRepository;
    /** 3단 대조·동명이곡 차단 — TextSearchService와 공용 부품. */
    private final CandidateMetaVerifier metaVerifier;

    public DeepSearchService(WebSongFinderClient webSongFinderClient,
                             AcrMetadataClient acrMetadataClient,
                             AiQuotaService aiQuotaService,
                             AiProperties aiProperties,
                             DeepSearchProperties deepProperties,
                             MusicService musicService,
                             UserService userService,
                             EventService eventService,
                             SearchHistoryRepository searchHistoryRepository) {
        this.webSongFinderClient = webSongFinderClient;
        this.aiQuotaService = aiQuotaService;
        this.aiProperties = aiProperties;
        this.deepProperties = deepProperties;
        this.musicService = musicService;
        this.userService = userService;
        this.eventService = eventService;
        this.searchHistoryRepository = searchHistoryRepository;
        this.metaVerifier = new CandidateMetaVerifier(acrMetadataClient, META_LOOKUP_MODE);
    }

    public SearchResponse search(String rawQuery, UUID sessionId, Jwt jwt) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < 2) {
            throw new IllegalArgumentException("검색 설명은 2~200자여야 합니다.");
        }
        // SecurityConfig가 /deep/**를 authenticated로 강제 — jwt는 항상 존재한다
        UUID userId = UUID.fromString(jwt.getSubject());

        try {
            aiQuotaService.checkDeepQuota(userId);
        } catch (AiQuotaExceededException e) {
            // 한도 거절도 수요 측정을 위해 기록하되, 카운트에서는 제외된다(outcome=quota)
            recordRequest(sessionId, userId, query, 0, 0, 0, 0, 0, "quota");
            throw e;
        }

        long t0 = System.nanoTime();
        List<WebSongCandidate> candidates;
        try {
            candidates = CompletableFuture
                    .supplyAsync(() -> webSongFinderClient.findCandidates(query), PIPELINE_EXECUTOR)
                    .orTimeout(deepProperties.timeoutMs(), TimeUnit.MILLISECONDS)
                    .join();
        } catch (Exception e) {
            long elapsed = elapsedMs(t0);
            // timeout=웹검색이 이미 돌던 실패(과금 가능성)라 차감 유지, 그 외 오류 응답은
            // 비용 미발생이라 환불된다(카운트 쿼리가 outcome=error를 제외 — 2026-08-05 개정)
            recordRequest(sessionId, userId, query, elapsed, 0, elapsed, 0, 0,
                    isTimeout(e) ? "timeout" : "error");
            throw asExternalApiException(e);
        }
        long webMs = elapsedMs(t0);

        List<WebSongCandidate> top = dedupe(candidates).stream().limit(MAX_CANDIDATES).toList();

        long metaStart = System.nanoTime();
        List<MetaEnrichment> enrichments = enrichInParallel(top);
        long metaMs = elapsedMs(metaStart);

        // 라벨링 — 필터가 아니다(FR-005): 대조 실패 후보도 미확인으로 유지해 신곡 오살을
        // 막는다. 확인된 후보는 카탈로그 값이 정본(웹 링크 무시, R4).
        List<SearchResponse.TrackResult> results = new ArrayList<>();
        int unverifiedCount = 0;
        for (int i = 0; i < top.size(); i++) {
            WebSongCandidate c = top.get(i);
            MetaEnrichment meta = enrichments.get(i);
            boolean verified = meta.verified();
            String videoId = verified ? meta.youtubeVideoId() : c.youtubeVideoId();
            String cover = verified
                    ? meta.coverUrlOrFallback()
                    : new MetaEnrichment(videoId, null).coverUrlOrFallback();
            if (!verified) {
                unverifiedCount++;
            }
            results.add(new SearchResponse.TrackResult(
                    AiKeyGenerator.keyOf(c.title(), c.joinedArtists()),
                    c.title(),
                    c.artists() == null
                            ? List.of()
                            : c.artists().stream().map(SearchResponse.Artist::new).toList(),
                    c.album() == null ? null : new SearchResponse.Album(c.album()),
                    null,
                    null,
                    videoId,
                    MusicResponse.toYoutubeUrl(videoId),
                    cover,
                    verified
            ));
        }
        long totalMs = elapsedMs(t0);

        recordRequest(sessionId, userId, query, webMs, metaMs, totalMs,
                results.size(), unverifiedCount, results.isEmpty() ? "empty" : "hit");

        return new SearchResponse(results);
    }

    /**
     * 후보 선택 확정 — 심층 흐름의 유일한 저장 시점. 미확인 곡도 웹 근거 링크·커버가
     * 후보 카드 값 그대로 저장까지 유지된다(FR-006, contracts §3이 정본).
     */
    public MusicResponse select(DeepSelectRequest request, UUID sessionId, Jwt jwt) {
        DeepSelectRequest.Candidate c = request.candidate();
        String expectedKey = AiKeyGenerator.keyOf(c.title(), c.joinedArtists());
        if (!expectedKey.equals(c.acrid())) {
            throw new IllegalArgumentException("후보 정보가 올바르지 않습니다.");
        }

        Music music = musicService.upsertFromRecognition(new MusicUpsertCommand(
                expectedKey,
                c.title(),
                c.joinedArtists(),
                c.album() == null ? null : c.album().name(),
                null,
                null,
                c.youtubeVideoId(),
                c.coverUrl(),
                "WEB"
        ));

        UUID userId = UUID.fromString(jwt.getSubject());
        try {
            // 프로필 JIT 보장 — 기존 검색 기록 경로와 동일(FK 보호)
            userService.getOrProvision(jwt);
            searchHistoryRepository.save(new SearchHistory(
                    userId, SearchHistory.Type.DEEP, SearchHistory.Status.MATCHED,
                    music.getId(), null));
        } catch (Exception e) {
            log.warn("심층 탐색 검색 기록 저장 실패", e);
        }

        Map<String, Object> props = new HashMap<>();
        props.put("rank", request.rank());
        props.put("ai_key", expectedKey);
        props.put("resolved", c.youtubeVideoId() != null);
        props.put("verified", Boolean.TRUE.equals(c.verified()));
        eventService.recordSilently("deep_search_select", sessionId, userId, props);

        return MusicResponse.from(music);
    }

    /** 제목+아티스트 정규화 키 기준 중복 제거(002와 동일 규칙). */
    private List<WebSongCandidate> dedupe(List<WebSongCandidate> candidates) {
        Set<String> seen = new HashSet<>();
        List<WebSongCandidate> unique = new ArrayList<>();
        for (WebSongCandidate c : candidates) {
            if (c == null || c.title() == null || c.title().isBlank()) {
                continue;
            }
            if (seen.add(AiKeyGenerator.keyOf(c.title(), c.joinedArtists()))) {
                unique.add(c);
            }
        }
        return unique;
    }

    /**
     * 후보 전건 메타 대조 병렬 실행 — 실패·데드라인 초과는 EMPTY(=미확인 라벨).
     * 002와 달리 제외가 아니라 라벨이므로, 대조가 늦어도 후보 자체는 살아남는다.
     */
    private List<MetaEnrichment> enrichInParallel(List<WebSongCandidate> candidates) {
        List<CompletableFuture<MetaEnrichment>> futures = candidates.stream()
                .map(c -> CompletableFuture.supplyAsync(
                        () -> metaVerifier.lookupWithAltFallback(c.asAiCandidate()),
                        PIPELINE_EXECUTOR)
                        .orTimeout(aiProperties.metaDeadlineMs(), TimeUnit.MILLISECONDS))
                .toList();
        return futures.stream()
                .map(f -> {
                    try {
                        return f.join();
                    } catch (Exception e) {
                        log.warn("심층 후보 메타 대조 실패 — 미확인으로 유지", e);
                        return MetaEnrichment.EMPTY;
                    }
                })
                .toList();
    }

    private boolean isTimeout(Exception e) {
        Throwable cause = e instanceof CompletionException && e.getCause() != null ? e.getCause() : e;
        return cause instanceof TimeoutException;
    }

    private ExternalApiException asExternalApiException(Exception e) {
        Throwable cause = e instanceof CompletionException && e.getCause() != null ? e.getCause() : e;
        if (cause instanceof ExternalApiException ee) {
            return ee;
        }
        log.warn("웹검색 후보 식별 실패", cause);
        return new ExternalApiException("심층 탐색이 잠시 원활하지 않아요.", cause);
    }

    private void recordRequest(UUID sessionId, UUID userId, String query,
                               long webMs, long metaMs, long totalMs,
                               int candidates, int unverified, String outcome) {
        Map<String, Object> props = new HashMap<>();
        props.put("query_len", query.length());
        props.put("web_ms", webMs);
        props.put("meta_ms", metaMs);
        props.put("total_ms", totalMs);
        props.put("candidates", candidates);
        props.put("unverified", unverified);
        props.put("outcome", outcome);
        eventService.recordSilently("deep_search_request", sessionId, userId, props);
    }

    private long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}
