package com.melolist.search.service;

import com.melolist.event.service.EventService;
import com.melolist.music.domain.Music;
import com.melolist.music.dto.MusicUpsertCommand;
import com.melolist.music.service.MusicService;
import com.melolist.search.client.AcrCloudClient;
import com.melolist.search.client.AcrMetadataClient;
import com.melolist.search.client.AcrTrack;
import com.melolist.search.client.MetaEnrichment;
import com.melolist.search.domain.SearchMode;
import com.melolist.search.dto.SearchResponse;
import com.melolist.search.repository.SearchHistoryRepository;
import com.melolist.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * M2 검색 파이프라인 단위 테스트 — ACRCloud는 전부 mock(backend-prd §11 DoD-5).
 */
@ExtendWith(MockitoExtension.class)
class SearchServiceTest {

    @Mock
    private AcrCloudClient acrCloudClient;
    @Mock
    private AcrMetadataClient acrMetadataClient;
    @Mock
    private MusicService musicService;
    @Mock
    private UserService userService;
    @Mock
    private EventService eventService;
    @Mock
    private SearchHistoryRepository searchHistoryRepository;

    @InjectMocks
    private SearchService searchService;

    private static final UUID SESSION_ID = UUID.randomUUID();

    private MockMultipartFile audioFile() {
        return new MockMultipartFile("audio", "sample.wav", "audio/wav", new byte[]{1, 2, 3});
    }

    private AcrTrack track(String acrid, String title, String artist, double score) {
        return new AcrTrack(acrid, title, List.of(artist), "Album", "2014-01-01", 231000, score);
    }

    private Music musicWithId(long id) {
        Music music = new Music();
        music.setId(id);
        music.setTitle("Blank Space");
        return music;
    }

    @Test
    void 매칭_성공시_계약_응답과_upsert_타이밍기록이_수행된다() {
        when(acrCloudClient.identify(any(), eq(SearchMode.FINGERPRINT)))
                .thenReturn(List.of(track("acr-1", "Blank Space", "Taylor Swift", 100)));
        when(acrMetadataClient.lookup(anyString(), anyString(), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("dC9QIUKviJU", "https://example.com/cover.jpg"));
        when(musicService.upsertFromRecognition(any())).thenReturn(musicWithId(10L));

        SearchResponse response = searchService.search(SearchMode.FINGERPRINT, audioFile(), SESSION_ID, null);

        assertThat(response.results()).hasSize(1);
        SearchResponse.TrackResult result = response.results().get(0);
        assertThat(result.acrid()).isEqualTo("acr-1");
        assertThat(result.youtubeVideoId()).isEqualTo("dC9QIUKviJU");
        assertThat(result.youtubeUrl()).isEqualTo("https://www.youtube.com/watch?v=dC9QIUKviJU");
        assertThat(result.coverUrl()).isEqualTo("https://example.com/cover.jpg");
        assertThat(result.artists()).extracting(SearchResponse.Artist::name).containsExactly("Taylor Swift");

        // upsert·기록은 응답 후 비동기 후처리(§5.3) — timeout 검증으로 대기
        ArgumentCaptor<MusicUpsertCommand> upsert = ArgumentCaptor.forClass(MusicUpsertCommand.class);
        verify(musicService, timeout(2000)).upsertFromRecognition(upsert.capture());
        assertThat(upsert.getValue().acrid()).isEqualTo("acr-1");
        assertThat(upsert.getValue().youtubeVideoId()).isEqualTo("dC9QIUKviJU");

        ArgumentCaptor<Map<String, Object>> props = ArgumentCaptor.forClass(Map.class);
        verify(eventService, timeout(2000)).recordSilently(eq("search_request"), eq(SESSION_ID), eq(null), props.capture());

        // 게스트(JWT 없음) → 검색 기록 저장 안 함 (후처리 완료 후 판정)
        verify(searchHistoryRepository, never()).save(any());
        assertThat(props.getValue())
                .containsEntry("mode", "fingerprint")
                .containsEntry("matched", true)
                .containsKeys("total_ms", "acr_ms", "meta_ms", "upsert_ms", "audio_bytes");
    }

    @Test
    void 무결과는_200_빈배열이며_search_failed가_기록된다() {
        when(acrCloudClient.identify(any(), eq(SearchMode.HUMMING))).thenReturn(List.of());

        SearchResponse response = searchService.search(SearchMode.HUMMING, audioFile(), SESSION_ID, null);

        assertThat(response.results()).isEmpty();
        verify(eventService, timeout(2000)).recordSilently(eq("search_failed"), eq(SESSION_ID), eq(null),
                eq(Map.of("mode", "humming", "reason", "no_match")));
        verify(musicService, never()).upsertFromRecognition(any());
    }

    @Test
    void 저신뢰_결과는_메타보강을_생략하되_응답에는_포함된다() {
        when(acrCloudClient.identify(any(), eq(SearchMode.HUMMING)))
                .thenReturn(List.of(
                        track("acr-hi", "Song A", "Artist A", 0.9),
                        track("acr-lo", "Song B", "Artist B", 0.3)));
        when(acrMetadataClient.lookup(eq("Song A"), eq("Artist A"), eq(SearchMode.HUMMING)))
                .thenReturn(new MetaEnrichment("vid-a", null));
        when(musicService.upsertFromRecognition(any())).thenReturn(musicWithId(1L));

        SearchResponse response = searchService.search(SearchMode.HUMMING, audioFile(), SESSION_ID, null);

        assertThat(response.results()).hasSize(2);
        // score 0.9 → 보강됨 + 커버는 ytimg 폴백(2단계)
        assertThat(response.results().get(0).coverUrl()).isEqualTo("https://i.ytimg.com/vi/vid-a/mqdefault.jpg");
        // score 0.3 → 보강 생략(§5.3), 커버·videoId null(3단계 폴백은 프론트 플레이스홀더)
        assertThat(response.results().get(1).youtubeVideoId()).isNull();
        assertThat(response.results().get(1).coverUrl()).isNull();
        verify(acrMetadataClient, never()).lookup(eq("Song B"), anyString(), any());
        // 비동기 후처리의 upsert 2건 완료까지 대기(테스트 종료 레이스 방지)
        verify(musicService, timeout(2000).times(2)).upsertFromRecognition(any());
    }

    @Test
    void 중복결과는_제목_아티스트_기준으로_제거되고_상위3곡만_남는다() {
        when(acrCloudClient.identify(any(), eq(SearchMode.FINGERPRINT)))
                .thenReturn(List.of(
                        track("a1", "Same Song", "Same Artist", 100),
                        track("a2", "Same Song", "Same Artist", 99),
                        track("a3", "Other 1", "Artist", 98),
                        track("a4", "Other 2", "Artist", 97),
                        track("a5", "Other 3", "Artist", 96)));
        when(acrMetadataClient.lookup(anyString(), anyString(), any())).thenReturn(MetaEnrichment.EMPTY);
        when(musicService.upsertFromRecognition(any())).thenReturn(musicWithId(1L));

        SearchResponse response = searchService.search(SearchMode.FINGERPRINT, audioFile(), SESSION_ID, null);

        assertThat(response.results()).hasSize(3);
        assertThat(response.results().get(0).acrid()).isEqualTo("a1");
        assertThat(response.results()).extracting(SearchResponse.TrackResult::acrid)
                .doesNotContain("a2", "a5");
        // 비동기 후처리의 upsert 3건(dedupe 후) 완료까지 대기
        verify(musicService, timeout(2000).times(3)).upsertFromRecognition(any());
    }

    @Test
    void 빈_오디오는_400() {
        MockMultipartFile empty = new MockMultipartFile("audio", "empty.wav", "audio/wav", new byte[0]);
        assertThatThrownBy(() -> searchService.search(SearchMode.FINGERPRINT, empty, SESSION_ID, null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 비오디오_MIME은_400() {
        MockMultipartFile pdf = new MockMultipartFile("audio", "doc.pdf", "application/pdf", new byte[]{1});
        assertThatThrownBy(() -> searchService.search(SearchMode.FINGERPRINT, pdf, SESSION_ID, null))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
