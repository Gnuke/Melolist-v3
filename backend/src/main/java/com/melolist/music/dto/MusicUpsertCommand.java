package com.melolist.music.dto;

import java.time.LocalDate;

/**
 * 인식 결과 → MUSIC upsert 입력. search 도메인이 ACRCloud 결과를 이 형태로 넘긴다.
 * spec 002: AI 폴백 선택 곡도 같은 경로로 upsert하며 {@code source}로 출처를 구분한다
 * (acrid에는 ai-key가 들어간다 — data-model §1).
 */
public record MusicUpsertCommand(
        String acrid,
        String title,
        String artist,
        String album,
        LocalDate releaseDate,
        Integer durationMs,
        String youtubeVideoId,
        String coverUrl,
        String source
) {
    /** 기존 인식(ACRCloud) 경로 — source 기본값 유지. */
    public MusicUpsertCommand(String acrid, String title, String artist, String album,
                              LocalDate releaseDate, Integer durationMs,
                              String youtubeVideoId, String coverUrl) {
        this(acrid, title, artist, album, releaseDate, durationMs, youtubeVideoId, coverUrl, "ACRCLOUD");
    }
}
