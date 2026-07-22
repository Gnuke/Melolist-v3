package com.melolist.search.service;

import com.melolist.common.error.ExternalApiException;
import com.melolist.event.service.EventService;
import com.melolist.music.domain.Music;
import com.melolist.music.dto.MusicResponse;
import com.melolist.music.dto.MusicUpsertCommand;
import com.melolist.music.service.MusicService;
import com.melolist.search.client.AiSongCandidate;
import com.melolist.search.client.AiSongFinderClient;
import com.melolist.search.client.AcrMetadataClient;
import com.melolist.search.client.MetaEnrichment;
import com.melolist.search.config.AiProperties;
import com.melolist.search.domain.SearchHistory;
import com.melolist.search.domain.SearchMode;
import com.melolist.search.dto.SearchResponse;
import com.melolist.search.dto.TextSelectRequest;
import com.melolist.search.repository.SearchHistoryRepository;
import com.melolist.user.service.UserService;
import lombok.RequiredArgsConstructor;
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

/**
 * AI 자연어 폴백 검색(spec 002) — 허밍/지문 실패 경로의 구제 파이프라인.
 *
 * <pre>
 * quota 검사 → [ai_ms] LLM 후보 식별(10s 컷) → [meta_ms] 메타 보강(병렬, 기존 클라이언트 재사용)
 *   → 응답(저장 없음) → (사용자 선택 시) select: upsert 1곡 + 기록 + 계측
 * </pre>
 *
 * 후보는 응답 시점에 저장하지 않는다 — 환각 곡의 DB 오염 방지(R5). 오디오는 이 경로에
 * 존재하지 않는다(텍스트만, FR-012). 계측(ai_search_request/ai_search_select)은
 * recordSilently(REQUIRES_NEW)라 본 흐름을 깨지 않는다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TextSearchService {

    private static final int MAX_CANDIDATES = 5;
    /** 메타 보강 토큰은 지문(music) 프로젝트 것을 쓴다 — TEXT 전용 토큰은 없다. */
    private static final SearchMode META_LOOKUP_MODE = SearchMode.FINGERPRINT;

    private static final ExecutorService PIPELINE_EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();

    private final AiSongFinderClient aiSongFinderClient;
    private final AcrMetadataClient acrMetadataClient;
    private final AiQuotaService aiQuotaService;
    private final AiProperties aiProperties;
    private final MusicService musicService;
    private final UserService userService;
    private final EventService eventService;
    private final SearchHistoryRepository searchHistoryRepository;

    public SearchResponse searchByText(String rawQuery, UUID sessionId, Jwt jwt) {
        String query = rawQuery == null ? "" : rawQuery.trim();
        if (query.length() < 2) {
            throw new IllegalArgumentException("검색 설명은 2~200자여야 합니다.");
        }
        UUID userId = currentUserId(jwt);

        try {
            aiQuotaService.checkQuota(sessionId, userId);
        } catch (com.melolist.common.error.AiQuotaExceededException e) {
            // 한도 거절도 수요 측정을 위해 기록하되, 카운트에서는 제외된다(outcome=quota)
            recordRequest(sessionId, userId, query, 0, 0, 0, 0, "quota");
            throw e;
        }

        long t0 = System.nanoTime();
        List<AiSongCandidate> candidates;
        try {
            candidates = findWithTimeout(query);
        } catch (Exception e) {
            long elapsed = elapsedMs(t0);
            recordRequest(sessionId, userId, query, elapsed, 0, elapsed, 0, "error");
            throw asExternalApiException(e);
        }
        long aiMs = elapsedMs(t0);

        List<AiSongCandidate> top = dedupe(candidates).stream().limit(MAX_CANDIDATES).toList();

        long metaStart = System.nanoTime();
        List<MetaEnrichment> enrichments = enrichInParallel(top);
        long metaMs = elapsedMs(metaStart);
        long totalMs = elapsedMs(t0);

        recordRequest(sessionId, userId, query, aiMs, metaMs, totalMs, top.size(),
                top.isEmpty() ? "empty" : "hit");

        return buildResponse(top, enrichments);
    }

    /**
     * 후보 선택 확정 — 폴백 흐름의 유일한 저장 시점(R5). 게스트도 upsert는 수행한다
     * (♡ → 로그인 유도 → 즐겨찾기 저장 흐름에서 곡 row가 먼저 존재해야 하므로).
     * 검색 기록(TEXT/MATCHED)은 로그인 사용자만(FR-006).
     */
    public MusicResponse select(TextSelectRequest request, UUID sessionId, Jwt jwt) {
        TextSelectRequest.Candidate c = request.candidate();
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
                "AI"
        ));

        UUID userId = currentUserId(jwt);
        if (jwt != null) {
            try {
                // 프로필 JIT 보장 — 기존 검색 기록 경로와 동일(FK 보호)
                userService.getOrProvision(jwt);
                searchHistoryRepository.save(new SearchHistory(
                        userId, SearchHistory.Type.TEXT, SearchHistory.Status.MATCHED,
                        music.getId(), null));
            } catch (Exception e) {
                log.warn("AI 폴백 검색 기록 저장 실패", e);
            }
        }

        Map<String, Object> props = new HashMap<>();
        props.put("rank", request.rank());
        props.put("ai_key", expectedKey);
        props.put("resolved", c.youtubeVideoId() != null);
        eventService.recordSilently("ai_search_select", sessionId, userId, props);

        return MusicResponse.from(music);
    }

    /** LLM 호출 10s 컷(R7) — 가상 스레드 + orTimeout, 기존 파이프라인 컷 패턴과 동일. */
    private List<AiSongCandidate> findWithTimeout(String query) {
        try {
            return CompletableFuture
                    .supplyAsync(() -> aiSongFinderClient.findCandidates(query), PIPELINE_EXECUTOR)
                    .orTimeout(aiProperties.timeoutMs(), TimeUnit.MILLISECONDS)
                    .join();
        } catch (CompletionException e) {
            throw e.getCause() instanceof RuntimeException re ? re : e;
        }
    }

    private ExternalApiException asExternalApiException(Exception e) {
        if (e instanceof ExternalApiException ee) {
            return ee;
        }
        log.warn("AI 후보 식별 실패", e);
        return new ExternalApiException("AI 검색이 잠시 원활하지 않아요.", e);
    }

    /** 제목+아티스트 정규화 키 기준 중복 제거 — LLM이 같은 곡을 표기만 바꿔 중복 반환하는 경우. */
    private List<AiSongCandidate> dedupe(List<AiSongCandidate> candidates) {
        Set<String> seen = new HashSet<>();
        List<AiSongCandidate> unique = new ArrayList<>();
        for (AiSongCandidate c : candidates) {
            if (c == null || c.title() == null || c.title().isBlank()) {
                continue;
            }
            if (seen.add(AiKeyGenerator.keyOf(c.title(), c.joinedArtists()))) {
                unique.add(c);
            }
        }
        return unique;
    }

    /** 후보 전건 메타 보강 병렬 실행 — 기존 enrich 패턴(§5.3). 실패는 EMPTY(링크 없이 표시). */
    private List<MetaEnrichment> enrichInParallel(List<AiSongCandidate> candidates) {
        List<CompletableFuture<MetaEnrichment>> futures = candidates.stream()
                .map(c -> CompletableFuture.supplyAsync(
                        () -> acrMetadataClient.lookup(c.title(), c.firstArtist(), META_LOOKUP_MODE),
                        PIPELINE_EXECUTOR))
                .toList();
        return futures.stream()
                .map(f -> {
                    try {
                        return f.join();
                    } catch (Exception e) {
                        log.warn("AI 후보 메타 보강 실패", e);
                        return MetaEnrichment.EMPTY;
                    }
                })
                .toList();
    }

    /** 기존 검색 결과와 동일 형태(R10) — acrid=ai-key, score/release_date는 항상 null. */
    private SearchResponse buildResponse(List<AiSongCandidate> candidates, List<MetaEnrichment> enrichments) {
        List<SearchResponse.TrackResult> results = new ArrayList<>();
        for (int i = 0; i < candidates.size(); i++) {
            AiSongCandidate c = candidates.get(i);
            MetaEnrichment meta = enrichments.get(i);
            results.add(new SearchResponse.TrackResult(
                    AiKeyGenerator.keyOf(c.title(), c.joinedArtists()),
                    c.title(),
                    c.artists() == null
                            ? List.of()
                            : c.artists().stream().map(SearchResponse.Artist::new).toList(),
                    c.album() == null ? null : new SearchResponse.Album(c.album()),
                    null,
                    null,
                    meta.youtubeVideoId(),
                    MusicResponse.toYoutubeUrl(meta.youtubeVideoId()),
                    meta.coverUrlOrFallback()
            ));
        }
        return new SearchResponse(results);
    }

    private void recordRequest(UUID sessionId, UUID userId, String query,
                               long aiMs, long metaMs, long totalMs, int candidates, String outcome) {
        Map<String, Object> props = new HashMap<>();
        props.put("query_len", query.length());
        props.put("ai_ms", aiMs);
        props.put("meta_ms", metaMs);
        props.put("total_ms", totalMs);
        props.put("candidates", candidates);
        props.put("outcome", outcome);
        eventService.recordSilently("ai_search_request", sessionId, userId, props);
    }

    private UUID currentUserId(Jwt jwt) {
        return jwt == null ? null : UUID.fromString(jwt.getSubject());
    }

    private long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}
