package com.melolist.search.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.NotFoundException;
import com.melolist.community.domain.Favorite;
import com.melolist.community.repository.FavoriteRepository;
import com.melolist.music.domain.Music;
import com.melolist.music.repository.MusicRepository;
import com.melolist.search.domain.SearchHistory;
import com.melolist.search.dto.SearchHistoryResponse;
import com.melolist.search.repository.SearchHistoryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** M3 검색 기록 조회/삭제 — top 곡 일괄 조인 + 소유자 한정 삭제. */
@ExtendWith(MockitoExtension.class)
class SearchHistoryServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final Pageable PAGE = PageRequest.of(0, 20);

    @Mock
    private SearchHistoryRepository searchHistoryRepository;
    @Mock
    private MusicRepository musicRepository;
    @Mock
    private FavoriteRepository favoriteRepository;

    @InjectMocks
    private SearchHistoryService service;

    @Test
    void 기록_페이지는_top곡을_일괄_조인하고_no_match는_music_null이다() {
        SearchHistory matched = new SearchHistory(
                USER_ID, SearchHistory.Type.HUMMING, SearchHistory.Status.MATCHED, 42L, new BigDecimal("0.96"));
        SearchHistory noMatch = new SearchHistory(
                USER_ID, SearchHistory.Type.FINGERPRINT, SearchHistory.Status.NO_MATCH, null, null);
        when(searchHistoryRepository.findByUserIdOrderByCreatedAtDesc(USER_ID, PAGE))
                .thenReturn(new PageImpl<>(List.of(matched, noMatch), PAGE, 2));
        Music music = mock(Music.class);
        when(music.getId()).thenReturn(42L);
        when(musicRepository.findAllById(Set.of(42L))).thenReturn(List.of(music));
        Favorite favorite = mock(Favorite.class);
        when(favorite.getMusic()).thenReturn(music);
        when(favoriteRepository.findByUserIdAndMusicIdIn(USER_ID, Set.of(42L))).thenReturn(List.of(favorite));

        PageResponse<SearchHistoryResponse> page = service.getPage(USER_ID, PAGE);

        assertThat(page.totalItems()).isEqualTo(2);
        assertThat(page.items().get(0).type()).isEqualTo("humming");
        assertThat(page.items().get(0).status()).isEqualTo("matched");
        assertThat(page.items().get(0).music().id()).isEqualTo(42L);
        assertThat(page.items().get(0).favorited()).isTrue();
        assertThat(page.items().get(1).status()).isEqualTo("no_match");
        assertThat(page.items().get(1).music()).isNull();
        assertThat(page.items().get(1).favorited()).isFalse();
    }

    @Test
    void 삭제는_소유자_한정이다() {
        SearchHistory mine = new SearchHistory(
                USER_ID, SearchHistory.Type.HUMMING, SearchHistory.Status.MATCHED, null, null);
        when(searchHistoryRepository.findByIdAndUserId(7L, USER_ID)).thenReturn(Optional.of(mine));

        service.remove(USER_ID, 7L);

        verify(searchHistoryRepository).delete(mine);
    }

    @Test
    void 비소유_또는_없는_기록_삭제는_404다() {
        when(searchHistoryRepository.findByIdAndUserId(7L, USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.remove(USER_ID, 7L)).isInstanceOf(NotFoundException.class);
        verify(searchHistoryRepository, never()).delete(any(SearchHistory.class));
    }
}
