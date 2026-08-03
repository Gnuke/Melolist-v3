package com.melolist.search.service;

import com.melolist.common.error.AiQuotaExceededException;
import com.melolist.common.error.ExternalApiException;
import com.melolist.event.service.EventService;
import com.melolist.music.domain.Music;
import com.melolist.music.dto.MusicResponse;
import com.melolist.music.dto.MusicUpsertCommand;
import com.melolist.music.service.MusicService;
import com.melolist.search.client.AcrMetadataClient;
import com.melolist.search.client.AiSongCandidate;
import com.melolist.search.client.AiSongFinderClient;
import com.melolist.search.client.MetaEnrichment;
import com.melolist.search.config.AiProperties;
import com.melolist.search.domain.SearchHistory;
import com.melolist.search.domain.SearchMode;
import com.melolist.search.dto.SearchResponse;
import com.melolist.search.dto.TextSelectRequest;
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
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AI 자연어 폴백 검색 단위 테스트(spec 002) — 외부(LLM·메타)는 전부 mock(원칙 VI).
 */
@ExtendWith(MockitoExtension.class)
class TextSearchServiceTest {

    @Mock
    private AiSongFinderClient aiSongFinderClient;
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

    private TextSearchService textSearchService;

    private static final UUID SESSION_ID = UUID.randomUUID();
    private static final UUID USER_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        AiProperties props = new AiProperties(10_000, "low", 8_000, new AiProperties.Quota(3, 10));
        textSearchService = new TextSearchService(
                aiSongFinderClient, acrMetadataClient, aiQuotaService, props,
                musicService, userService, eventService, searchHistoryRepository);
    }

    private Jwt jwtOf(UUID userId) {
        Jwt jwt = mock(Jwt.class);
        when(jwt.getSubject()).thenReturn(userId.toString());
        return jwt;
    }

    @Test
    void 후보가_있으면_기존_계약_형태로_반환하고_저장은_하지_않는다() {
        when(aiSongFinderClient.findCandidates(anyString()))
                .thenReturn(List.of(new AiSongCandidate("좋은 날", List.of("아이유"), "Real")));
        when(acrMetadataClient.lookup(eq("좋은 날"), eq("아이유"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("jeqdYqsrsA0", null));

        SearchResponse response = textSearchService.searchByText("여자 보컬 좋은 날", SESSION_ID, null);

        assertThat(response.results()).hasSize(1);
        SearchResponse.TrackResult r = response.results().get(0);
        assertThat(r.acrid()).isEqualTo(AiKeyGenerator.keyOf("좋은 날", "아이유"));
        assertThat(r.score()).isNull();
        assertThat(r.releaseDate()).isNull();
        assertThat(r.artists()).extracting(SearchResponse.Artist::name).containsExactly("아이유");
        assertThat(r.youtubeUrl()).isEqualTo("https://www.youtube.com/watch?v=jeqdYqsrsA0");
        // 커버 미제공 → ytimg 폴백(§5.2)
        assertThat(r.coverUrl()).isEqualTo("https://i.ytimg.com/vi/jeqdYqsrsA0/mqdefault.jpg");

        // 검색 응답 시점에는 저장하지 않는다(R5)
        verify(musicService, never()).upsertFromRecognition(any());

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("ai_search_request"), eq(SESSION_ID), eq(null), props.capture());
        assertThat(props.getValue())
                .containsEntry("outcome", "hit")
                .containsEntry("candidates", 1)
                .containsKeys("query_len", "ai_ms", "meta_ms", "total_ms");
    }

    @Test
    void 같은_곡_중복후보는_제거되고_5곡까지만_반환한다() {
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("Same Song", List.of("Artist"), null),
                new AiSongCandidate("same  song", List.of("ARTIST"), null),   // 정규화 중복
                new AiSongCandidate("S1", List.of("A"), null),
                new AiSongCandidate("S2", List.of("A"), null),
                new AiSongCandidate("S3", List.of("A"), null),
                new AiSongCandidate("S4", List.of("A"), null),
                new AiSongCandidate("S5", List.of("A"), null)));
        when(acrMetadataClient.lookup(anyString(), anyString(), any()))
                .thenReturn(new MetaEnrichment("vid00000000", null));

        SearchResponse response = textSearchService.searchByText("dup test", SESSION_ID, null);

        assertThat(response.results()).hasSize(5);
        assertThat(response.results().get(0).title()).isEqualTo("Same Song");
    }

    @Test
    void 메타_대조_실패_후보는_제외하고_대조_성공_후보만_반환한다() {
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("좋은 날", List.of("아이유"), "Real"),
                new AiSongCandidate("흔적", List.of("윤종신"), null)));
        when(acrMetadataClient.lookup(eq("좋은 날"), eq("아이유"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("jeqdYqsrsA0", null));
        when(acrMetadataClient.lookup(eq("흔적"), eq("윤종신"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);

        SearchResponse response = textSearchService.searchByText("아이유 발라드", SESSION_ID, null);

        assertThat(response.results()).hasSize(1);
        assertThat(response.results().get(0).title()).isEqualTo("좋은 날");

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("ai_search_request"), eq(SESSION_ID), eq(null), props.capture());
        assertThat(props.getValue())
                .containsEntry("outcome", "hit")
                .containsEntry("candidates", 1)
                .containsEntry("filtered", 1);
    }

    @Test
    void 커버만_있는_후보도_실존_확인으로_보고_유지한다() {
        // 카탈로그에 있으나 유튜브 매핑만 없는 곡 — videoId 기준으로 자르면 실존곡이 사라진다
        when(aiSongFinderClient.findCandidates(anyString()))
                .thenReturn(List.of(new AiSongCandidate("Old Song", List.of("Artist"), null)));
        when(acrMetadataClient.lookup(eq("Old Song"), eq("Artist"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment(null, "https://cover/medium.jpg"));

        SearchResponse response = textSearchService.searchByText("옛날 노래", SESSION_ID, null);

        assertThat(response.results()).hasSize(1);
        assertThat(response.results().get(0).youtubeUrl()).isNull();
        assertThat(response.results().get(0).coverUrl()).isEqualTo("https://cover/medium.jpg");
    }

    @Test
    void 한글_대조_0건이면_영문_표기로_최종_대조해_살린다() {
        // ②(원제목+로마자 아티스트)도 실패하고 ③(영문 제목)에서 살아나는 흔적→Trace 유형
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("흔적", List.of("윤종신"), null, "Trace", "Yoon Jong Shin")));
        when(acrMetadataClient.lookup(eq("흔적"), eq("윤종신"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);
        when(acrMetadataClient.lookup(eq("흔적"), eq("Yoon Jong Shin"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);
        when(acrMetadataClient.lookup(eq("Trace"), eq("Yoon Jong Shin"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("XPxqh7pzxHE", null));

        SearchResponse response = textSearchService.searchByText("예전에 들었던 발라드", SESSION_ID, null);

        assertThat(response.results()).hasSize(1);
        SearchResponse.TrackResult r = response.results().get(0);
        assertThat(r.title()).isEqualTo("흔적");   // 표시·ai_key는 원표기 유지
        assertThat(r.youtubeUrl()).isEqualTo("https://www.youtube.com/watch?v=XPxqh7pzxHE");

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("ai_search_request"), eq(SESSION_ID), eq(null), props.capture());
        assertThat(props.getValue()).containsEntry("candidates", 1).containsEntry("filtered", 0);
    }

    @Test
    void 원제목_로마자_아티스트_교차_대조로_살린다() {
        // ACR 최다 유형(관측): 한글 제목 + 로마자 아티스트 등재 — 미소천사/Sung Si Kyung
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("미소천사", List.of("성시경"), null, "Smile Angel", "Sung Si Kyung")));
        when(acrMetadataClient.lookup(eq("미소천사"), eq("성시경"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);
        when(acrMetadataClient.lookup(eq("미소천사"), eq("Sung Si Kyung"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("ro1knsWzgjQ", null));

        SearchResponse response = textSearchService.searchByText("성시경 노랜데 댄스곡", SESSION_ID, null);

        assertThat(response.results()).hasSize(1);
        assertThat(response.results().get(0).title()).isEqualTo("미소천사");
        assertThat(response.results().get(0).youtubeUrl())
                .isEqualTo("https://www.youtube.com/watch?v=ro1knsWzgjQ");
        // ②에서 성공 — ③(영문 제목) 조회까지 가지 않는다
        verify(acrMetadataClient, never()).lookup(eq("Smile Angel"), anyString(), any());
    }

    @Test
    void 일차_대조_성공이면_이차_조회는_하지_않는다() {
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("좋은 날", List.of("아이유"), null, "Good Day", "IU")));
        when(acrMetadataClient.lookup(eq("좋은 날"), eq("아이유"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("jeqdYqsrsA0", null));

        textSearchService.searchByText("아이유 노래", SESSION_ID, null);

        verify(acrMetadataClient, times(1)).lookup(anyString(), anyString(), any());
    }

    @Test
    void 영문_표기가_원표기와_같으면_이차_조회를_생략한다() {
        // 영문 곡은 1차와 동일 조회가 되므로 재시도 무의미 — 4s 타임아웃 낭비 방지
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("Dynamite", List.of("BTS"), null, "dynamite", "BTS")));
        when(acrMetadataClient.lookup(eq("Dynamite"), eq("BTS"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);

        SearchResponse response = textSearchService.searchByText("신나는 노래", SESSION_ID, null);

        assertThat(response.results()).isEmpty();
        verify(acrMetadataClient, times(1)).lookup(anyString(), anyString(), any());
    }

    @Test
    void 대조_반환_아티스트가_후보와_다르면_동명이곡_오염으로_제외한다() {
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("흔적", List.of("윤종신"), null, null, "Yoon Jong Shin")));
        // 실측 사례: 요청 아티스트와 다른 가수의 동명곡이 링크와 함께 반환되는 경우
        when(acrMetadataClient.lookup(eq("흔적"), eq("윤종신"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("wrongVid0001", null, List.of("Yoon Jeong ah")));
        when(acrMetadataClient.lookup(eq("흔적"), eq("Yoon Jong Shin"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);

        SearchResponse response = textSearchService.searchByText("발라드 흔적", SESSION_ID, null);

        assertThat(response.results()).isEmpty();
    }

    @Test
    void 반환_아티스트는_로마자_표기와_정규화_비교로_일치_판정한다() {
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("미소천사", List.of("성시경"), null, null, "Sung Si Kyung")));
        when(acrMetadataClient.lookup(eq("미소천사"), eq("성시경"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);
        // 표기 변형(대소문자·하이픈)이어도 정규화 비교로 일치해야 한다
        when(acrMetadataClient.lookup(eq("미소천사"), eq("Sung Si Kyung"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("ro1knsWzgjQ", null, List.of("SUNG SI-KYUNG")));

        SearchResponse response = textSearchService.searchByText("성시경 댄스곡", SESSION_ID, null);

        assertThat(response.results()).hasSize(1);
        assertThat(response.results().get(0).title()).isEqualTo("미소천사");
    }

    @Test
    void 메타_대조가_데드라인을_넘긴_후보는_제외된다() {
        AiProperties fast = new AiProperties(10_000, "low", 200, new AiProperties.Quota(3, 10));
        TextSearchService svc = new TextSearchService(
                aiSongFinderClient, acrMetadataClient, aiQuotaService, fast,
                musicService, userService, eventService, searchHistoryRepository);
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("느린 곡", List.of("A"), null)));
        when(acrMetadataClient.lookup(anyString(), anyString(), any())).thenAnswer(inv -> {
            Thread.sleep(1_000);
            return new MetaEnrichment("vid00000000", null);
        });

        SearchResponse response = svc.searchByText("느린 메타 응답", SESSION_ID, null);

        assertThat(response.results()).isEmpty();
    }

    @Test
    void 전부_메타_대조_실패면_빈배열이고_outcome_empty로_기록된다() {
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of(
                new AiSongCandidate("가공의 곡", List.of("A"), null),
                new AiSongCandidate("없는 곡", List.of("B"), null)));
        when(acrMetadataClient.lookup(anyString(), anyString(), any())).thenReturn(MetaEnrichment.EMPTY);

        SearchResponse response = textSearchService.searchByText("환각 유발 설명", SESSION_ID, null);

        assertThat(response.results()).isEmpty();
        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("ai_search_request"), eq(SESSION_ID), eq(null), props.capture());
        assertThat(props.getValue())
                .containsEntry("outcome", "empty")
                .containsEntry("candidates", 0)
                .containsEntry("filtered", 2);
    }

    @Test
    void 모델을_2회_병렬_샘플링하고_각_샘플의_1순위가_상위_2위_안에_온다() {
        // 리콜 변동 보정 — 한 샘플이 유명곡 패딩이어도 다른 샘플의 정답이 상위에 들어야 한다
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(
                List.of(new AiSongCandidate("거리에서", List.of("성시경"), null),
                        new AiSongCandidate("좋을텐데", List.of("성시경"), null)),
                List.of(new AiSongCandidate("미소천사", List.of("성시경"), null),
                        new AiSongCandidate("넌 감동이었어", List.of("성시경"), null)));
        when(acrMetadataClient.lookup(anyString(), anyString(), any()))
                .thenReturn(new MetaEnrichment("vid00000000", null));

        SearchResponse response = textSearchService.searchByText("성시경 노랜데 댄스곡", SESSION_ID, null);

        verify(aiSongFinderClient, times(2)).findCandidates(anyString());
        assertThat(response.results()).hasSize(4);
        List<String> top2 = List.of(response.results().get(0).title(), response.results().get(1).title());
        assertThat(top2).contains("미소천사");
        assertThat(top2).contains("거리에서");
    }

    @Test
    void 한쪽_샘플이_실패해도_다른_샘플로_응답한다() {
        when(aiSongFinderClient.findCandidates(anyString()))
                .thenThrow(new RuntimeException("sample fail"))
                .thenReturn(List.of(new AiSongCandidate("미소천사", List.of("성시경"), null)));
        when(acrMetadataClient.lookup(anyString(), anyString(), any()))
                .thenReturn(new MetaEnrichment("ro1knsWzgjQ", null));

        SearchResponse response = textSearchService.searchByText("성시경 노랜데 댄스곡", SESSION_ID, null);

        assertThat(response.results()).hasSize(1);
        assertThat(response.results().get(0).title()).isEqualTo("미소천사");
        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("ai_search_request"), eq(SESSION_ID), eq(null), props.capture());
        assertThat(props.getValue()).containsEntry("outcome", "hit");
    }

    @Test
    void 무후보는_200_빈배열이며_outcome_empty로_기록된다() {
        when(aiSongFinderClient.findCandidates(anyString())).thenReturn(List.of());

        SearchResponse response = textSearchService.searchByText("존재하지 않는 곡 설명", SESSION_ID, null);

        assertThat(response.results()).isEmpty();
        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("ai_search_request"), eq(SESSION_ID), eq(null), props.capture());
        assertThat(props.getValue()).containsEntry("outcome", "empty").containsEntry("candidates", 0);
    }

    @Test
    void LLM_실패는_502_외부API예외로_변환되고_outcome_error로_기록된다() {
        when(aiSongFinderClient.findCandidates(anyString())).thenThrow(new RuntimeException("boom"));

        assertThatThrownBy(() -> textSearchService.searchByText("아무 설명", SESSION_ID, null))
                .isInstanceOf(ExternalApiException.class);

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("ai_search_request"), eq(SESSION_ID), eq(null), props.capture());
        assertThat(props.getValue()).containsEntry("outcome", "error");
    }

    @Test
    void 한도초과는_429로_전파되고_outcome_quota로_기록된다() {
        doThrow(new AiQuotaExceededException(3, ZonedDateTime.now(ZoneId.of("Asia/Seoul")).plusDays(1)))
                .when(aiQuotaService).checkQuota(SESSION_ID, null);

        assertThatThrownBy(() -> textSearchService.searchByText("아무 설명", SESSION_ID, null))
                .isInstanceOf(AiQuotaExceededException.class);

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("ai_search_request"), eq(SESSION_ID), eq(null), props.capture());
        assertThat(props.getValue()).containsEntry("outcome", "quota");
        verify(aiSongFinderClient, never()).findCandidates(anyString());
    }

    @Test
    void 두글자_미만_입력은_400() {
        assertThatThrownBy(() -> textSearchService.searchByText("  a  ", SESSION_ID, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 선택확정은_source_AI로_upsert하고_로그인이면_TEXT_기록을_남긴다() {
        String key = AiKeyGenerator.keyOf("좋은 날", "아이유");
        TextSelectRequest request = new TextSelectRequest(
                new TextSelectRequest.Candidate(key, "좋은 날",
                        List.of(new SearchResponse.Artist("아이유")),
                        new SearchResponse.Album("Real"), "jeqdYqsrsA0", "https://cover"),
                1);
        Music saved = new Music();
        saved.setId(77L);
        saved.setTitle("좋은 날");
        when(musicService.upsertFromRecognition(any())).thenReturn(saved);

        MusicResponse response = textSearchService.select(request, SESSION_ID, jwtOf(USER_ID));

        assertThat(response.id()).isEqualTo(77L);

        ArgumentCaptor<MusicUpsertCommand> upsert = ArgumentCaptor.forClass(MusicUpsertCommand.class);
        verify(musicService).upsertFromRecognition(upsert.capture());
        assertThat(upsert.getValue().acrid()).isEqualTo(key);
        assertThat(upsert.getValue().source()).isEqualTo("AI");
        assertThat(upsert.getValue().artist()).isEqualTo("아이유");

        ArgumentCaptor<SearchHistory> history = ArgumentCaptor.forClass(SearchHistory.class);
        verify(searchHistoryRepository).save(history.capture());
        assertThat(history.getValue().getType()).isEqualTo(SearchHistory.Type.TEXT);
        assertThat(history.getValue().getStatus()).isEqualTo(SearchHistory.Status.MATCHED);
        assertThat(history.getValue().getTopMusicId()).isEqualTo(77L);

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService).recordSilently(eq("ai_search_select"), eq(SESSION_ID), eq(USER_ID), props.capture());
        assertThat(props.getValue())
                .containsEntry("rank", 1)
                .containsEntry("ai_key", key)
                .containsEntry("resolved", true);
    }

    @Test
    void 게스트_선택확정은_upsert만_하고_기록은_남기지_않는다() {
        String key = AiKeyGenerator.keyOf("Ditto", "NewJeans");
        TextSelectRequest request = new TextSelectRequest(
                new TextSelectRequest.Candidate(key, "Ditto",
                        List.of(new SearchResponse.Artist("NewJeans")), null, null, null),
                2);
        Music saved = new Music();
        saved.setId(78L);
        saved.setTitle("Ditto");
        when(musicService.upsertFromRecognition(any())).thenReturn(saved);

        textSearchService.select(request, SESSION_ID, null);

        verify(musicService).upsertFromRecognition(any());
        verify(searchHistoryRepository, never()).save(any());
    }

    @Test
    void 위조된_acrid는_400() {
        TextSelectRequest request = new TextSelectRequest(
                new TextSelectRequest.Candidate("ai-0000000000000000", "좋은 날",
                        List.of(new SearchResponse.Artist("아이유")), null, null, null),
                1);

        assertThatThrownBy(() -> textSearchService.select(request, SESSION_ID, null))
                .isInstanceOf(IllegalArgumentException.class);
        verify(musicService, never()).upsertFromRecognition(any());
    }
}
