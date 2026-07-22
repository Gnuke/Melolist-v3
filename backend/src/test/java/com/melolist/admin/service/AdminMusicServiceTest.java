package com.melolist.admin.service;

import com.melolist.admin.domain.AdminAuditLog;
import com.melolist.admin.dto.AdminMusicDtos.MusicAdminItem;
import com.melolist.admin.dto.AdminMusicDtos.UpdateRequest;
import com.melolist.admin.error.InvalidAdminArgumentException;
import com.melolist.admin.repository.AdminMusicRepository;
import com.melolist.admin.repository.AdminMusicRepository.ReferenceCountRow;
import com.melolist.common.error.ConflictException;
import com.melolist.common.error.NotFoundException;
import com.melolist.music.domain.Music;
import com.melolist.music.repository.MusicRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** US2 곡 부분 수정(담긴 필드만·빈 문자열=비우기)·잠금·삭제 차단·감사 기록. */
@ExtendWith(MockitoExtension.class)
class AdminMusicServiceTest {

    private static final UUID ADMIN_ID = UUID.randomUUID();
    private static final long MUSIC_ID = 42L;

    @Mock
    private MusicRepository musicRepository;
    @Mock
    private AdminMusicRepository adminMusicRepository;
    @Mock
    private AdminAuditService adminAuditService;

    @InjectMocks
    private AdminMusicService service;

    private Music music;

    @BeforeEach
    void setUp() {
        music = new Music();
        music.setAcrid("acr-42");
        music.setTitle("잘못된 제목");
        music.setArtist("가수");
        lenient().when(musicRepository.findById(MUSIC_ID)).thenReturn(Optional.of(music));
    }

    private UpdateRequest request(String title, String artist, String album,
                                  String releaseDate, String videoId, String coverUrl) {
        return new UpdateRequest(title, artist, album, releaseDate, videoId, coverUrl);
    }

    private ReferenceCountRow references(long favorites, long playlistItems, long histories) {
        ReferenceCountRow row = mock(ReferenceCountRow.class);
        lenient().when(row.getFavoriteCount()).thenReturn(favorites);
        lenient().when(row.getPlaylistItemCount()).thenReturn(playlistItems);
        lenient().when(row.getHistoryCount()).thenReturn(histories);
        return row;
    }

    @Test
    void 담긴_필드만_반영되고_meta_locked가_켜지고_감사가_남는다() {
        MusicAdminItem result = service.update(ADMIN_ID, MUSIC_ID,
                request("Blank Space", null, null, "2014-10-27", "dC9QIUKviJU", null));

        assertThat(result.title()).isEqualTo("Blank Space");
        assertThat(result.artist()).isEqualTo("가수");                    // null = 미변경
        assertThat(result.releaseDate()).isEqualTo(LocalDate.of(2014, 10, 27));
        assertThat(result.youtubeVideoId()).isEqualTo("dC9QIUKviJU");
        assertThat(result.metaLocked()).isTrue();
        verify(adminAuditService).record(eq(ADMIN_ID), eq(AdminAuditLog.ACTION_MUSIC_UPDATE),
                eq("MUSIC"), eq(String.valueOf(MUSIC_ID)), anyMap(), anyMap());
    }

    @Test
    void 빈_문자열은_null로_정규화되어_값을_비운다() {
        music.setCoverUrl("https://wrong.example/cover.jpg");
        music.setYoutubeVideoId("wrongVideo1");

        service.update(ADMIN_ID, MUSIC_ID, request(null, null, null, null, "", ""));

        assertThat(music.getCoverUrl()).isNull();
        assertThat(music.getYoutubeVideoId()).isNull();
        assertThat(music.getTitle()).isEqualTo("잘못된 제목");            // 미변경
        assertThat(music.isMetaLocked()).isTrue();
    }

    @Test
    void title은_비울_수_없다() {
        assertThatThrownBy(() -> service.update(ADMIN_ID, MUSIC_ID,
                request("   ", null, null, null, null, null)))
                .isInstanceOf(InvalidAdminArgumentException.class)
                .satisfies(e -> assertThat(((InvalidAdminArgumentException) e).getField()).isEqualTo("title"));
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void 영상_ID는_11자_형식만_허용한다() {
        assertThatThrownBy(() -> service.update(ADMIN_ID, MUSIC_ID,
                request(null, null, null, null, "too-short", null)))
                .isInstanceOf(InvalidAdminArgumentException.class)
                .satisfies(e -> assertThat(((InvalidAdminArgumentException) e).getField())
                        .isEqualTo("youtube_video_id"));
    }

    @Test
    void 잘못된_missing_값은_거부한다() {
        assertThatThrownBy(() -> service.list(null, "audio", org.springframework.data.domain.PageRequest.of(0, 20)))
                .isInstanceOf(InvalidAdminArgumentException.class);
    }

    @Test
    void 참조가_있으면_삭제가_차단되고_참조_현황을_안내한다() {
        ReferenceCountRow row = references(2, 1, 5);
        when(adminMusicRepository.countReferences(MUSIC_ID)).thenReturn(row);

        assertThatThrownBy(() -> service.delete(ADMIN_ID, MUSIC_ID))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("즐겨찾기 2")
                .hasMessageContaining("플레이리스트 1")
                .hasMessageContaining("검색기록 5");
        verify(musicRepository, never()).delete(any());
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void 참조가_없으면_삭제하고_감사가_남는다() {
        ReferenceCountRow row = references(0, 0, 0);
        when(adminMusicRepository.countReferences(MUSIC_ID)).thenReturn(row);

        service.delete(ADMIN_ID, MUSIC_ID);

        verify(musicRepository).delete(music);
        verify(adminAuditService).record(eq(ADMIN_ID), eq(AdminAuditLog.ACTION_MUSIC_DELETE),
                eq("MUSIC"), eq(String.valueOf(MUSIC_ID)), anyMap(), isNull());
    }

    @Test
    void 없는_곡은_404다() {
        when(musicRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(999L)).isInstanceOf(NotFoundException.class);
    }
}
