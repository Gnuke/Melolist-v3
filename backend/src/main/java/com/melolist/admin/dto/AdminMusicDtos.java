package com.melolist.admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.music.domain.Music;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 곡 관리 계약(front 계약 §2·§3 — MusicAdminItem). meta_locked는 백엔드 추가 필드
 * (FR-007 잠금 상태 — 프론트는 무시 가능).
 */
public final class AdminMusicDtos {

    private AdminMusicDtos() {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record MusicAdminItem(
            Long id,
            String acrid,
            String title,
            String artist,
            String album,
            LocalDate releaseDate,
            String youtubeVideoId,
            String coverUrl,
            Integer durationMs,
            String source,
            boolean metaLocked,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static MusicAdminItem from(Music m) {
            return new MusicAdminItem(m.getId(), m.getAcrid(), m.getTitle(), m.getArtist(), m.getAlbum(),
                    m.getReleaseDate(), m.getYoutubeVideoId(), m.getCoverUrl(), m.getDurationMs(),
                    m.getSource(), m.isMetaLocked(), m.getCreatedAt(), m.getUpdatedAt());
        }
    }

    /** 참조 카운트 — 삭제 가능 여부 판단용(백엔드 전용 GET /{id}, research D8). */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record References(long favoriteCount, long playlistItemCount, long historyCount) {
        public boolean any() {
            return favoriteCount + playlistItemCount + historyCount > 0;
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record MusicDetail(MusicAdminItem music, References references) {
        public static MusicDetail of(Music m, References references) {
            return new MusicDetail(MusicAdminItem.from(m), references);
        }
    }

    /**
     * 부분 수정(front 계약 §3) — 담긴 필드만 반영. null(미포함) = 미변경,
     * 빈 문자열 = null로 정규화(값 비우기). 형식 검증은 서비스에서(INVALID_ARGUMENT + details.field).
     */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record UpdateRequest(
            String title,
            String artist,
            String album,
            String releaseDate,
            String youtubeVideoId,
            String coverUrl
    ) {
    }
}
