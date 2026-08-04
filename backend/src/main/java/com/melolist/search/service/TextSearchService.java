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
 * quota 검사 → [ai_ms] LLM 후보 식별(2회 병렬 샘플링·각 10s 컷·순위 교차 병합)
 *   → [meta_ms] 메타 보강(병렬, 기존 클라이언트 재사용)
 *   → 대조 실패 후보 제외 → 응답(저장 없음) → (사용자 선택 시) select: upsert 1곡 + 기록 + 계측
 * </pre>
 *
 * 후보는 응답 시점에 저장하지 않는다 — 환각 곡의 DB 오염 방지(R5). 오디오는 이 경로에
 * 존재하지 않는다(텍스트만, FR-012). 계측(ai_search_request/ai_search_select)은
 * recordSilently(REQUIRES_NEW)라 본 흐름을 깨지 않는다.
 */
@Service
@Slf4j
public class TextSearchService {

    private static final int MAX_CANDIDATES = 5;
    /** 리콜 변동 보정용 병렬 샘플 수 — 쿼터는 요청 1회로 계산(모델 호출 비용만 배수). */
    private static final int AI_SAMPLES = 2;
    /** 메타 보강 토큰은 지문(music) 프로젝트 것을 쓴다 — TEXT 전용 토큰은 없다. */
    private static final SearchMode META_LOOKUP_MODE = SearchMode.FINGERPRINT;

    private static final ExecutorService PIPELINE_EXECUTOR = Executors.newVirtualThreadPerTaskExecutor();

    private final AiSongFinderClient aiSongFinderClient;
    private final AiQuotaService aiQuotaService;
    private final AiProperties aiProperties;
    private final MusicService musicService;
    private final UserService userService;
    private final EventService eventService;
    private final SearchHistoryRepository searchHistoryRepository;
    /** 3단 대조·동명이곡 차단 — DeepSearchService와 공용 부품(spec 004에서 추출). */
    private final CandidateMetaVerifier metaVerifier;

    public TextSearchService(AiSongFinderClient aiSongFinderClient,
                             AcrMetadataClient acrMetadataClient,
                             AiQuotaService aiQuotaService,
                             AiProperties aiProperties,
                             MusicService musicService,
                             UserService userService,
                             EventService eventService,
                             SearchHistoryRepository searchHistoryRepository) {
        this.aiSongFinderClient = aiSongFinderClient;
        this.aiQuotaService = aiQuotaService;
        this.aiProperties = aiProperties;
        this.musicService = musicService;
        this.userService = userService;
        this.eventService = eventService;
        this.searchHistoryRepository = searchHistoryRepository;
        this.metaVerifier = new CandidateMetaVerifier(acrMetadataClient, META_LOOKUP_MODE);
    }

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
            recordRequest(sessionId, userId, query, 0, 0, 0, 0, "quota", 0);
            throw e;
        }

        long t0 = System.nanoTime();
        List<AiSongCandidate> candidates;
        try {
            candidates = findWithSampling(query);
        } catch (Exception e) {
            long elapsed = elapsedMs(t0);
            recordRequest(sessionId, userId, query, elapsed, 0, elapsed, 0, "error", 0);
            throw asExternalApiException(e);
        }
        long aiMs = elapsedMs(t0);

        List<AiSongCandidate> top = dedupe(candidates).stream().limit(MAX_CANDIDATES).toList();

        long metaStart = System.nanoTime();
        List<MetaEnrichment> enrichments = enrichInParallel(top);
        long metaMs = elapsedMs(metaStart);

        // 메타 대조 실패 후보 제외 — 카탈로그에서 실존 근거를 못 찾은 곡(환각 의심)은
        // 노출하지 않는다. 메타 API 장애 시에도 전부 EMPTY라 빈 결과가 되는 트레이드오프.
        List<AiSongCandidate> verified = new ArrayList<>();
        List<MetaEnrichment> verifiedMeta = new ArrayList<>();
        List<AiSongCandidate> dropped = new ArrayList<>();
        for (int i = 0; i < top.size(); i++) {
            if (enrichments.get(i).verified()) {
                verified.add(top.get(i));
                verifiedMeta.add(enrichments.get(i));
            } else {
                dropped.add(top.get(i));
            }
        }
        if (!dropped.isEmpty()) {
            // 잘린 후보가 뭐였는지 없이는 오살(실존곡 탈락) 진단이 불가능하다 — 곡명 로그 필수
            log.info("AI 후보 메타 대조 탈락 {}건 — {}", dropped.size(), dropped.stream()
                    .map(d -> d.title() + "/" + d.joinedArtists() + " (alt " + d.titleAlt() + "/" + d.artistAlt() + ")")
                    .collect(java.util.stream.Collectors.joining(", ")));
        }
        long totalMs = elapsedMs(t0);

        recordRequest(sessionId, userId, query, aiMs, metaMs, totalMs, verified.size(),
                verified.isEmpty() ? "empty" : "hit", top.size() - verified.size());

        return buildResponse(verified, verifiedMeta);
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

    /**
     * 리콜 변동 보정 — 동일 질의 {@value #AI_SAMPLES}회 병렬 샘플링 후 순위 교차 병합
     * (실측: 단발 포함률 ~80% → 두 샘플 동시 누락 ~4%). 지연은 병렬이라 max(호출들),
     * 각 호출은 10s 컷(R7). 일부 실패는 성공 샘플로 진행, 전부 실패면 예외 전파.
     */
    private List<AiSongCandidate> findWithSampling(String query) {
        List<CompletableFuture<List<AiSongCandidate>>> futures = new ArrayList<>();
        for (int i = 0; i < AI_SAMPLES; i++) {
            futures.add(CompletableFuture
                    .supplyAsync(() -> aiSongFinderClient.findCandidates(query), PIPELINE_EXECUTOR)
                    .orTimeout(aiProperties.timeoutMs(), TimeUnit.MILLISECONDS));
        }

        List<List<AiSongCandidate>> samples = new ArrayList<>();
        RuntimeException failure = null;
        for (CompletableFuture<List<AiSongCandidate>> f : futures) {
            try {
                samples.add(f.join());
            } catch (CompletionException e) {
                failure = e.getCause() instanceof RuntimeException re ? re : e;
            }
        }
        if (samples.isEmpty()) {
            throw failure;
        }
        return interleaveByRank(samples);
    }

    /** 순위 교차 병합(각 샘플 1위 → 각 2위 …) — 한 샘플이 패딩이어도 정답이 상위에 든다. */
    private static List<AiSongCandidate> interleaveByRank(List<List<AiSongCandidate>> samples) {
        List<AiSongCandidate> merged = new ArrayList<>();
        int maxSize = samples.stream().mapToInt(List::size).max().orElse(0);
        for (int rank = 0; rank < maxSize; rank++) {
            for (List<AiSongCandidate> sample : samples) {
                if (rank < sample.size()) {
                    merged.add(sample.get(rank));
                }
            }
        }
        return merged;
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

    /**
     * 후보 전건 메타 보강 병렬 실행 — 기존 enrich 패턴(§5.3). 실패는 EMPTY.
     * 후보별 3단 체인은 최악 12s(4s×3)라 소프트 데드라인으로 꼬리를 잘라
     * 클라 15s 예산을 보호한다 — 넘긴 후보는 미검증 처리(제외).
     */
    private List<MetaEnrichment> enrichInParallel(List<AiSongCandidate> candidates) {
        List<CompletableFuture<MetaEnrichment>> futures = candidates.stream()
                .map(c -> CompletableFuture.supplyAsync(
                        () -> metaVerifier.lookupWithAltFallback(c),
                        PIPELINE_EXECUTOR)
                        .orTimeout(aiProperties.metaDeadlineMs(), TimeUnit.MILLISECONDS))
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
                               long aiMs, long metaMs, long totalMs, int candidates, String outcome,
                               int filtered) {
        Map<String, Object> props = new HashMap<>();
        props.put("query_len", query.length());
        props.put("ai_ms", aiMs);
        props.put("meta_ms", metaMs);
        props.put("total_ms", totalMs);
        props.put("candidates", candidates);
        props.put("outcome", outcome);
        props.put("filtered", filtered);
        eventService.recordSilently("ai_search_request", sessionId, userId, props);
    }

    private UUID currentUserId(Jwt jwt) {
        return jwt == null ? null : UUID.fromString(jwt.getSubject());
    }

    private long elapsedMs(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}
