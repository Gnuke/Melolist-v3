package com.melolist.playlist.service;

import com.melolist.common.error.ConflictException;
import com.melolist.common.error.ForbiddenException;
import com.melolist.common.error.NotFoundException;
import com.melolist.music.domain.Music;
import com.melolist.music.repository.MusicRepository;
import com.melolist.playlist.domain.Playlist;
import com.melolist.playlist.domain.PlaylistMusic;
import com.melolist.playlist.dto.PlaylistDtos.PlaylistDetailResponse;
import com.melolist.playlist.dto.PlaylistDtos.ReorderRequest;
import com.melolist.playlist.dto.PlaylistDtos.UpdateRequest;
import com.melolist.playlist.repository.PlaylistMusicRepository;
import com.melolist.playlist.repository.PlaylistRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 소유권 분기(비공개=404 숨김·공개=403)와 position 재매김 — PRD §7·부록 A-2. */
@ExtendWith(MockitoExtension.class)
class PlaylistServiceTest {

    private static final Long PLAYLIST_ID = 7L;
    private static final UUID OWNER_ID = UUID.randomUUID();
    private static final UUID OTHER_ID = UUID.randomUUID();

    @Mock
    private PlaylistRepository playlistRepository;
    @Mock
    private PlaylistMusicRepository playlistMusicRepository;
    @Mock
    private MusicRepository musicRepository;

    @InjectMocks
    private PlaylistService playlistService;

    @Test
    void 비공개_플레이리스트는_비소유자에게_404다() {
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(false)));

        assertThatThrownBy(() -> playlistService.update(PLAYLIST_ID, OTHER_ID, new UpdateRequest("제목", null, null, null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void 공개_플레이리스트라도_비소유자_변경은_403이다() {
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(true)));

        assertThatThrownBy(() -> playlistService.update(PLAYLIST_ID, OTHER_ID, new UpdateRequest("제목", null, null, null)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void 공개_플레이리스트는_게스트도_상세를_조회한다() {
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(true)));
        when(playlistMusicRepository.findByPlaylistIdOrderByPositionAsc(PLAYLIST_ID)).thenReturn(List.of());

        PlaylistDetailResponse response = playlistService.getDetail(PLAYLIST_ID, null);

        assertThat(response.id()).isEqualTo(PLAYLIST_ID);
    }

    @Test
    void 비공개_상세는_게스트에게_404다() {
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(false)));

        assertThatThrownBy(() -> playlistService.getDetail(PLAYLIST_ID, null))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void 곡은_맨_뒤_position에_추가된다() {
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(false)));
        when(musicRepository.findById(42L)).thenReturn(Optional.of(mock(Music.class)));
        when(playlistMusicRepository.existsByPlaylistIdAndMusicId(PLAYLIST_ID, 42L)).thenReturn(false);
        when(playlistMusicRepository.countByPlaylistId(PLAYLIST_ID)).thenReturn(3);

        playlistService.addTrack(PLAYLIST_ID, OWNER_ID, 42L);

        ArgumentCaptor<PlaylistMusic> saved = ArgumentCaptor.forClass(PlaylistMusic.class);
        verify(playlistMusicRepository).save(saved.capture());
        assertThat(saved.getValue().getPosition()).isEqualTo(3);
    }

    @Test
    void 이미_담긴_곡은_409다() {
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(false)));
        when(musicRepository.findById(42L)).thenReturn(Optional.of(mock(Music.class)));
        when(playlistMusicRepository.existsByPlaylistIdAndMusicId(PLAYLIST_ID, 42L)).thenReturn(true);

        assertThatThrownBy(() -> playlistService.addTrack(PLAYLIST_ID, OWNER_ID, 42L))
                .isInstanceOf(ConflictException.class);
        verify(playlistMusicRepository, never()).save(any());
    }

    @Test
    void 트랙_삭제_후_position_공백을_메운다() {
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(false)));
        PlaylistMusic target = track(9L, 1);
        when(playlistMusicRepository.findByPlaylistIdAndMusicId(PLAYLIST_ID, 9L)).thenReturn(Optional.of(target));
        PlaylistMusic first = track(1L, 0);
        PlaylistMusic third = track(3L, 2);
        when(playlistMusicRepository.findByPlaylistIdOrderByPositionAsc(PLAYLIST_ID)).thenReturn(List.of(first, third));

        playlistService.removeTrack(PLAYLIST_ID, OWNER_ID, 9L);

        verify(playlistMusicRepository).delete(target);
        assertThat(first.getPosition()).isEqualTo(0);
        assertThat(third.getPosition()).isEqualTo(1);
    }

    @Test
    void reorder는_전달_순서대로_position을_다시_매긴다() {
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(false)));
        PlaylistMusic t1 = track(1L, 0);
        PlaylistMusic t2 = track(2L, 1);
        PlaylistMusic t3 = track(3L, 2);
        when(playlistMusicRepository.findByPlaylistIdOrderByPositionAsc(PLAYLIST_ID)).thenReturn(List.of(t1, t2, t3));

        playlistService.reorder(PLAYLIST_ID, OWNER_ID, new ReorderRequest(List.of(3L, 1L, 2L)));

        assertThat(t3.getPosition()).isEqualTo(0);
        assertThat(t1.getPosition()).isEqualTo(1);
        assertThat(t2.getPosition()).isEqualTo(2);
    }

    @Test
    void reorder_개수가_다르면_400이다() {
        List<PlaylistMusic> tracks = List.of(track(1L, 0), track(2L, 1));
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(false)));
        when(playlistMusicRepository.findByPlaylistIdOrderByPositionAsc(PLAYLIST_ID)).thenReturn(tracks);

        assertThatThrownBy(() -> playlistService.reorder(PLAYLIST_ID, OWNER_ID, new ReorderRequest(List.of(1L))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reorder_목록에_없는_곡_id는_400이다() {
        List<PlaylistMusic> tracks = List.of(track(1L, 0), track(2L, 1));
        when(playlistRepository.findById(PLAYLIST_ID)).thenReturn(Optional.of(playlist(false)));
        when(playlistMusicRepository.findByPlaylistIdOrderByPositionAsc(PLAYLIST_ID)).thenReturn(tracks);

        assertThatThrownBy(() -> playlistService.reorder(PLAYLIST_ID, OWNER_ID, new ReorderRequest(List.of(1L, 99L))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private Playlist playlist(boolean isPublic) {
        Playlist playlist = new Playlist(OWNER_ID, "출근길", null, isPublic);
        playlist.setId(PLAYLIST_ID);
        return playlist;
    }

    private PlaylistMusic track(long musicId, int position) {
        Music music = mock(Music.class);
        lenient().when(music.getId()).thenReturn(musicId);
        return new PlaylistMusic(PLAYLIST_ID, music, position);
    }
}
