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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 웹검색 심층 탐색 파이프라인(spec 004) — 핵심 차이: 메타 대조가 필터가 아닌
 * verified 라벨이다(대조 실패 후보도 유지, FR-005). 외부는 전부 mock(원칙 VI).
 */
@ExtendWith(MockitoExtension.class)
class DeepSearchServiceTest {

    @Mock
    private WebSongFinderClient webSongFinderClient;
    @Mock
    private AcrMetadataClient acrMetadataClient;
    @Mock
    private AiQuotaService aiQuotaService;
    @Mock
    private MusicService musicService;
    @Mock
    private UserService userService;
    @Mock
    private EventService eventService;
    @Mock
    private SearchHistoryRepository searchHistoryRepository;

    private DeepSearchService deepSearchService;

    private static final UUID SESSION_ID = UUID.randomUUID();
    private static final UUID USER_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        deepSearchService = newService(new DeepSearchProperties(22_000, 2));
    }

    private DeepSearchService newService(DeepSearchProperties deepProps) {
        return new DeepSearchService(
                webSongFinderClient, acrMetadataClient, aiQuotaService,
                new AiProperties(10_000, "low", 8_000, new AiProperties.Quota(3, 10)),
                deepProps, musicService, userService, eventService, searchHistoryRepository);
    }

    private Jwt jwtOf(UUID userId) {
        // 400 계열 테스트는 subject를 읽기 전에 예외가 나므로 엄격 모드에서 미사용 판정 — lenient
        Jwt jwt = mock(Jwt.class);
        org.mockito.Mockito.lenient().when(jwt.getSubject()).thenReturn(userId.toString());
        return jwt;
    }

    @Test
    void 대조_실패_후보도_제외하지_않고_미확인으로_반환한다() {
        when(webSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new WebSongCandidate("확인곡", List.of("가수"), null, null, null, null),
                new WebSongCandidate("신곡", List.of("신인"), null, null, null, "dQw4w9WgXcQ")));
        when(acrMetadataClient.lookup(eq("확인곡"), eq("가수"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("catVid00001", null));
        when(acrMetadataClient.lookup(eq("신곡"), eq("신인"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);

        SearchResponse response = deepSearchService.search("최근에 나온 신곡", SESSION_ID, jwtOf(USER_ID));

        assertThat(response.results()).hasSize(2);
        SearchResponse.TrackResult verified = response.results().get(0);
        assertThat(verified.verified()).isTrue();
        assertThat(verified.youtubeVideoId()).isEqualTo("catVid00001");

        SearchResponse.TrackResult unverified = response.results().get(1);
        assertThat(unverified.verified()).isFalse();
        // 미확인 후보는 웹 근거 링크를 표시·저장에 사용(Clarifications Q1)
        assertThat(unverified.youtubeVideoId()).isEqualTo("dQw4w9WgXcQ");
        assertThat(unverified.youtubeUrl()).isEqualTo("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
        assertThat(unverified.coverUrl()).isEqualTo("https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("deep_search_request"), eq(SESSION_ID), eq(USER_ID), props.capture());
        assertThat(props.getValue())
                .containsEntry("outcome", "hit")
                .containsEntry("candidates", 2)
                .containsEntry("unverified", 1)
                .containsKeys("query_len", "web_ms", "meta_ms", "total_ms");
    }

    @Test
    void 확인된_후보는_카탈로그_값이_정본이라_웹_링크를_무시한다() {
        when(webSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new WebSongCandidate("확인곡", List.of("가수"), null, null, null, "webVidXXXX1")));
        when(acrMetadataClient.lookup(eq("확인곡"), eq("가수"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("catVid00001", "https://cover/medium.jpg"));

        SearchResponse response = deepSearchService.search("확인되는 곡", SESSION_ID, jwtOf(USER_ID));

        SearchResponse.TrackResult r = response.results().get(0);
        assertThat(r.verified()).isTrue();
        assertThat(r.youtubeVideoId()).isEqualTo("catVid00001");
        assertThat(r.coverUrl()).isEqualTo("https://cover/medium.jpg");
    }

    @Test
    void 전부_미확인이어도_후보를_유지하고_outcome_hit이다() {
        when(webSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new WebSongCandidate("신곡A", List.of("신인A"), null, null, null, "dQw4w9WgXcQ"),
                new WebSongCandidate("신곡B", List.of("신인B"), null, null, null, null)));
        when(acrMetadataClient.lookup(anyString(), anyString(), any())).thenReturn(MetaEnrichment.EMPTY);

        SearchResponse response = deepSearchService.search("이번 주 신곡", SESSION_ID, jwtOf(USER_ID));

        assertThat(response.results()).hasSize(2);
        assertThat(response.results()).allSatisfy(r -> assertThat(r.verified()).isFalse());

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("deep_search_request"), eq(SESSION_ID), eq(USER_ID), props.capture());
        assertThat(props.getValue())
                .containsEntry("outcome", "hit")
                .containsEntry("candidates", 2)
                .containsEntry("unverified", 2);
    }

    @Test
    void 웹_링크가_없는_미확인_후보는_링크와_커버_없이_반환한다() {
        when(webSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new WebSongCandidate("신곡B", List.of("신인B"), null, null, null, null)));
        when(acrMetadataClient.lookup(anyString(), anyString(), any())).thenReturn(MetaEnrichment.EMPTY);

        SearchResponse response = deepSearchService.search("링크 없는 신곡", SESSION_ID, jwtOf(USER_ID));

        SearchResponse.TrackResult r = response.results().get(0);
        assertThat(r.verified()).isFalse();
        assertThat(r.youtubeVideoId()).isNull();
        assertThat(r.youtubeUrl()).isNull();
        assertThat(r.coverUrl()).isNull();
    }

    @Test
    void 중복_후보는_제거되고_5곡_상한이다() {
        when(webSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new WebSongCandidate("Same Song", List.of("Artist"), null, null, null, null),
                new WebSongCandidate("same  song", List.of("ARTIST"), null, null, null, null),
                new WebSongCandidate("S1", List.of("A"), null, null, null, null),
                new WebSongCandidate("S2", List.of("A"), null, null, null, null),
                new WebSongCandidate("S3", List.of("A"), null, null, null, null),
                new WebSongCandidate("S4", List.of("A"), null, null, null, null),
                new WebSongCandidate("S5", List.of("A"), null, null, null, null)));
        when(acrMetadataClient.lookup(anyString(), anyString(), any())).thenReturn(MetaEnrichment.EMPTY);

        SearchResponse response = deepSearchService.search("dup test", SESSION_ID, jwtOf(USER_ID));

        assertThat(response.results()).hasSize(5);
        assertThat(response.results().get(0).title()).isEqualTo("Same Song");
    }

    @Test
    void 무후보는_200_빈배열이며_outcome_empty로_기록된다() {
        when(webSongFinderClient.findCandidates(anyString())).thenReturn(List.of());

        SearchResponse response = deepSearchService.search("존재하지 않는 곡", SESSION_ID, jwtOf(USER_ID));

        assertThat(response.results()).isEmpty();
        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("deep_search_request"), eq(SESSION_ID), eq(USER_ID), props.capture());
        assertThat(props.getValue()).containsEntry("outcome", "empty").containsEntry("candidates", 0);
    }

    @Test
    void 웹검색_실패는_502_외부API예외로_변환되고_outcome_error로_기록된다() {
        when(webSongFinderClient.findCandidates(anyString())).thenThrow(new RuntimeException("boom"));

        assertThatThrownBy(() -> deepSearchService.search("아무 설명", SESSION_ID, jwtOf(USER_ID)))
                .isInstanceOf(ExternalApiException.class);

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("deep_search_request"), eq(SESSION_ID), eq(USER_ID), props.capture());
        assertThat(props.getValue()).containsEntry("outcome", "error");
    }

    @Test
    void 호출_컷을_넘기면_502로_실패한다() {
        DeepSearchService fast = newService(new DeepSearchProperties(200, 2));
        when(webSongFinderClient.findCandidates(anyString())).thenAnswer(inv -> {
            Thread.sleep(1_000);
            return List.of();
        });

        assertThatThrownBy(() -> fast.search("느린 웹검색", SESSION_ID, jwtOf(USER_ID)))
                .isInstanceOf(ExternalApiException.class);
    }

    @Test
    void 한도초과는_429로_전파되고_outcome_quota로_기록된다() {
        doThrow(new AiQuotaExceededException(2,
                ZonedDateTime.now(ZoneId.of("Asia/Seoul")).plusDays(1), "오늘의 심층 탐색 횟수를 모두 사용했어요."))
                .when(aiQuotaService).checkDeepQuota(USER_ID);

        assertThatThrownBy(() -> deepSearchService.search("아무 설명", SESSION_ID, jwtOf(USER_ID)))
                .isInstanceOf(AiQuotaExceededException.class);

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("deep_search_request"), eq(SESSION_ID), eq(USER_ID), props.capture());
        assertThat(props.getValue()).containsEntry("outcome", "quota");
        verify(webSongFinderClient, never()).findCandidates(anyString());
    }

    @Test
    void 두글자_미만_입력은_400() {
        assertThatThrownBy(() -> deepSearchService.search("  a  ", SESSION_ID, jwtOf(USER_ID)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(aiQuotaService, never()).checkDeepQuota(any());
    }

    @Test
    void 선택확정은_source_WEB으로_upsert하고_DEEP_기록과_이벤트를_남긴다() {
        String key = AiKeyGenerator.keyOf("신곡", "신인");
        DeepSelectRequest request = new DeepSelectRequest(
                new DeepSelectRequest.Candidate(key, "신곡",
                        List.of(new SearchResponse.Artist("신인")), null,
                        "dQw4w9WgXcQ", "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg", false),
                2);
        Music saved = new Music();
        saved.setId(91L);
        saved.setTitle("신곡");
        when(musicService.upsertFromRecognition(any())).thenReturn(saved);

        MusicResponse response = deepSearchService.select(request, SESSION_ID, jwtOf(USER_ID));

        assertThat(response.id()).isEqualTo(91L);

        ArgumentCaptor<MusicUpsertCommand> upsert = ArgumentCaptor.forClass(MusicUpsertCommand.class);
        verify(musicService).upsertFromRecognition(upsert.capture());
        assertThat(upsert.getValue().acrid()).isEqualTo(key);
        assertThat(upsert.getValue().source()).isEqualTo("WEB");
        // 미확인 곡도 웹 근거 링크가 저장까지 유지된다(FR-006)
        assertThat(upsert.getValue().youtubeVideoId()).isEqualTo("dQw4w9WgXcQ");

        ArgumentCaptor<SearchHistory> history = ArgumentCaptor.forClass(SearchHistory.class);
        verify(searchHistoryRepository).save(history.capture());
        assertThat(history.getValue().getType()).isEqualTo(SearchHistory.Type.DEEP);
        assertThat(history.getValue().getStatus()).isEqualTo(SearchHistory.Status.MATCHED);
        assertThat(history.getValue().getTopMusicId()).isEqualTo(91L);

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("deep_search_select"), eq(SESSION_ID), eq(USER_ID), props.capture());
        assertThat(props.getValue())
                .containsEntry("rank", 2)
                .containsEntry("ai_key", key)
                .containsEntry("resolved", true)
                .containsEntry("verified", false);
    }

    @Test
    void 링크_없는_후보_선택은_resolved_false로_기록된다() {
        String key = AiKeyGenerator.keyOf("신곡B", "신인B");
        DeepSelectRequest request = new DeepSelectRequest(
                new DeepSelectRequest.Candidate(key, "신곡B",
                        List.of(new SearchResponse.Artist("신인B")), null, null, null, false),
                1);
        Music saved = new Music();
        saved.setId(92L);
        when(musicService.upsertFromRecognition(any())).thenReturn(saved);

        deepSearchService.select(request, SESSION_ID, jwtOf(USER_ID));

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("deep_search_select"), eq(SESSION_ID), eq(USER_ID), props.capture());
        assertThat(props.getValue()).containsEntry("resolved", false);
    }

    @Test
    void 위조된_acrid는_400() {
        DeepSelectRequest request = new DeepSelectRequest(
                new DeepSelectRequest.Candidate("ai-0000000000000000", "신곡",
                        List.of(new SearchResponse.Artist("신인")), null, null, null, false),
                1);

        assertThatThrownBy(() -> deepSearchService.select(request, SESSION_ID, jwtOf(USER_ID)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(musicService, never()).upsertFromRecognition(any());
    }
}
