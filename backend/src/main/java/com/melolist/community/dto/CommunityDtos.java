package com.melolist.community.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.playlist.dto.PlaylistDtos.PlaylistResponse;

import java.time.Instant;
import java.util.UUID;

public final class CommunityDtos {

    private CommunityDtos() {
    }

    /**
     * 커뮤니티 공개 피드 항목 — 기존 PlaylistResponse에 작성자 요약을 더한 확장형(spec 005 R4).
     * 소유자 맥락 화면들이 쓰는 공용 PlaylistResponse는 건드리지 않는다.
     */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CommunityPlaylistResponse(
            Long id,
            UUID ownerId,
            String title,
            String description,
            boolean isPublic,
            String coverUrl,
            int trackCount,
            Instant createdAt,
            Instant updatedAt,
            AuthorSummary author
    ) {
        public static CommunityPlaylistResponse from(PlaylistResponse p, AuthorSummary author) {
            return new CommunityPlaylistResponse(p.id(), p.ownerId(), p.title(), p.description(),
                    p.isPublic(), p.coverUrl(), p.trackCount(), p.createdAt(), p.updatedAt(), author);
        }
    }
}
