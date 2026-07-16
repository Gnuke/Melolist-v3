package com.melolist.community.service;

import com.melolist.common.error.NotFoundException;
import com.melolist.community.domain.Favorite;
import com.melolist.community.dto.FavoriteDtos.FavoriteResponse;
import com.melolist.community.repository.FavoriteRepository;
import com.melolist.music.domain.Music;
import com.melolist.music.repository.MusicRepository;
import com.melolist.user.domain.Profile;
import com.melolist.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;
import org.mockito.InjectMocks;

/** M3 즐겨찾기 실저장 — acrid 담기 경로(검색 결과 화면에는 musicId가 없다). */
@ExtendWith(MockitoExtension.class)
class FavoriteServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final String ACRID = "f624a2598138cd2c144063f979601929";
    private static final long MUSIC_ID = 42L;

    @Mock
    private FavoriteRepository favoriteRepository;
    @Mock
    private MusicRepository musicRepository;
    @Mock
    private UserService userService;

    @InjectMocks
    private FavoriteService favoriteService;

    private final Jwt jwt = mock(Jwt.class);
    private Music music;

    @BeforeEach
    void setUp() {
        Profile profile = mock(Profile.class);
        lenient().when(profile.getId()).thenReturn(USER_ID);
        lenient().when(userService.getOrProvisionProfile(jwt)).thenReturn(profile);
        music = mock(Music.class);
        lenient().when(music.getId()).thenReturn(MUSIC_ID);
    }

    @Test
    void acrid로_담으면_저장하고_musicId를_응답한다() {
        when(musicRepository.findByAcrid(ACRID)).thenReturn(Optional.of(music));
        when(favoriteRepository.findByUserIdAndMusicId(USER_ID, MUSIC_ID)).thenReturn(Optional.empty());
        when(favoriteRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        FavoriteResponse response = favoriteService.add(jwt, null, ACRID);

        assertThat(response.music().id()).isEqualTo(MUSIC_ID);
        verify(favoriteRepository).save(any(Favorite.class));
    }

    @Test
    void 이미_담긴_곡이면_저장_없이_기존_행을_반환한다() {
        when(musicRepository.findByAcrid(ACRID)).thenReturn(Optional.of(music));
        when(favoriteRepository.findByUserIdAndMusicId(USER_ID, MUSIC_ID))
                .thenReturn(Optional.of(new Favorite(USER_ID, music)));

        FavoriteResponse response = favoriteService.add(jwt, null, ACRID);

        assertThat(response.music().id()).isEqualTo(MUSIC_ID);
        verify(favoriteRepository, never()).save(any());
    }

    @Test
    void 아직_upsert_안_된_acrid는_404다() {
        when(musicRepository.findByAcrid(ACRID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> favoriteService.add(jwt, null, ACRID))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void 식별자가_둘_다_없으면_400이다() {
        assertThatThrownBy(() -> favoriteService.add(jwt, null, "  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void unique_경합으로_저장이_거부되면_기존_행을_반환한다() {
        when(musicRepository.findByAcrid(ACRID)).thenReturn(Optional.of(music));
        when(favoriteRepository.findByUserIdAndMusicId(USER_ID, MUSIC_ID))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(new Favorite(USER_ID, music)));
        when(favoriteRepository.save(any())).thenThrow(new DataIntegrityViolationException("dup"));

        FavoriteResponse response = favoriteService.add(jwt, null, ACRID);

        assertThat(response.music().id()).isEqualTo(MUSIC_ID);
    }
}
