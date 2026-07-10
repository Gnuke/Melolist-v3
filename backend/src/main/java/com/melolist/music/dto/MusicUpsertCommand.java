package com.melolist.music.dto;

import java.time.LocalDate;

/**
 * 인식 결과 → MUSIC upsert 입력. search 도메인이 ACRCloud 결과를 이 형태로 넘긴다.
 */
public record MusicUpsertCommand(
        String acrid,
        String title,
        String artist,
        String album,
        LocalDate releaseDate,
        Integer durationMs,
        String youtubeVideoId,
        String coverUrl
) {
}
