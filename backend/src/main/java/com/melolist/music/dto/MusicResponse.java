package com.melolist.music.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.music.domain.Music;

import java.time.LocalDate;

/**
 * 곡 응답 DTO. {@code youtube_url}은 videoId에서 파생한다(backend-prd C1 —
 * 파생 URL은 결정적이므로 정보 손실 없음).
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record MusicResponse(
        Long id,
        String title,
        String artist,
        String album,
        LocalDate releaseDate,
        String youtubeVideoId,
        String youtubeUrl,
        String coverUrl,
        Integer durationMs
) {
    public static MusicResponse from(Music m) {
        return new MusicResponse(
                m.getId(),
                m.getTitle(),
                m.getArtist(),
                m.getAlbum(),
                m.getReleaseDate(),
                m.getYoutubeVideoId(),
                toYoutubeUrl(m.getYoutubeVideoId()),
                m.getCoverUrl(),
                m.getDurationMs()
        );
    }

    public static String toYoutubeUrl(String videoId) {
        return videoId == null ? null : "https://www.youtube.com/watch?v=" + videoId;
    }
}
