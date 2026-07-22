package com.melolist.music.service;

import com.melolist.music.domain.Music;
import com.melolist.music.dto.MusicUpsertCommand;
import com.melolist.music.repository.MusicRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

/** upsert 잠금 보호(spec 003 FR-007) — 관리자 수동 정정 곡은 자동 보강이 건드리지 않는다. */
@ExtendWith(MockitoExtension.class)
class MusicServiceTest {

    private static final String ACRID = "f624a2598138cd2c144063f979601929";

    @Mock
    private MusicRepository musicRepository;

    @InjectMocks
    private MusicService musicService;

    private MusicUpsertCommand command() {
        return new MusicUpsertCommand(ACRID, "새 제목", "새 가수", "새 앨범",
                LocalDate.of(2020, 1, 1), 200_000, "dQw4w9WgXcQ", "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg");
    }

    @Test
    void 잠긴_곡은_비어_있는_필드도_채우지_않는다() {
        Music locked = new Music();
        locked.setAcrid(ACRID);
        locked.setTitle("정정된 제목");
        locked.setMetaLocked(true);          // videoId·cover·앨범 전부 null인 상태
        when(musicRepository.findByAcrid(ACRID)).thenReturn(Optional.of(locked));

        Music result = musicService.upsertFromRecognition(command());

        assertThat(result.getTitle()).isEqualTo("정정된 제목");
        assertThat(result.getYoutubeVideoId()).isNull();
        assertThat(result.getCoverUrl()).isNull();
        assertThat(result.getAlbum()).isNull();
        assertThat(result.getReleaseDate()).isNull();
        assertThat(result.getDurationMs()).isNull();
    }

    @Test
    void 안_잠긴_곡은_기존대로_null_필드만_채운다() {
        Music existing = new Music();
        existing.setAcrid(ACRID);
        existing.setTitle("기존 제목");
        existing.setCoverUrl("https://existing.example/cover.jpg");   // 비어 있지 않은 필드는 유지
        when(musicRepository.findByAcrid(ACRID)).thenReturn(Optional.of(existing));

        Music result = musicService.upsertFromRecognition(command());

        assertThat(result.getTitle()).isEqualTo("기존 제목");
        assertThat(result.getYoutubeVideoId()).isEqualTo("dQw4w9WgXcQ");            // null이라 채움
        assertThat(result.getCoverUrl()).isEqualTo("https://existing.example/cover.jpg"); // 덮지 않음
        assertThat(result.getAlbum()).isEqualTo("새 앨범");
        assertThat(result.getDurationMs()).isEqualTo(200_000);
    }
}
