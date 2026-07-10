package com.melolist.playlist.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.music.dto.MusicResponse;
import com.melolist.playlist.domain.Playlist;
import com.melolist.playlist.domain.PlaylistMusic;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * playlist 도메인 요청/응답 DTO 모음(PRD §7 playlist).
 */
public final class PlaylistDtos {

    private PlaylistDtos() {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(
            @NotBlank @Size(max = 120) String title,
            String description,
            Boolean isPublic
    ) {
    }

    /** PATCH 부분 수정 — null 필드는 변경하지 않는다. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record UpdateRequest(
            @Size(max = 120) String title,
            String description,
            Boolean isPublic,
            String coverUrl
    ) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record TrackAddRequest(@NotNull Long musicId) {
    }

    /** 순서 변경 — 플레이리스트에 담긴 전체 music id를 새 순서대로 보낸다. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ReorderRequest(@NotEmpty List<Long> musicIds) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PlaylistResponse(
            Long id,
            UUID ownerId,
            String title,
            String description,
            boolean isPublic,
            String coverUrl,
            int trackCount,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static PlaylistResponse from(Playlist p, int trackCount) {
            return new PlaylistResponse(p.getId(), p.getOwnerId(), p.getTitle(), p.getDescription(),
                    p.isPublic(), p.getCoverUrl(), trackCount, p.getCreatedAt(), p.getUpdatedAt());
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PlaylistDetailResponse(
            Long id,
            UUID ownerId,
            String title,
            String description,
            boolean isPublic,
            String coverUrl,
            List<TrackItem> tracks,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static PlaylistDetailResponse from(Playlist p, List<PlaylistMusic> tracks) {
            return new PlaylistDetailResponse(p.getId(), p.getOwnerId(), p.getTitle(), p.getDescription(),
                    p.isPublic(), p.getCoverUrl(),
                    tracks.stream().map(TrackItem::from).toList(),
                    p.getCreatedAt(), p.getUpdatedAt());
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record TrackItem(MusicResponse music, int position, Instant addedAt) {
        public static TrackItem from(PlaylistMusic pm) {
            return new TrackItem(MusicResponse.from(pm.getMusic()), pm.getPosition(), pm.getAddedAt());
        }
    }
}
