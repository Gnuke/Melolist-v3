package com.melolist.community.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.community.domain.Comment;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class CommentDtos {

    private CommentDtos() {
    }

    /** 내용 상한 300자 — spec 005 FR-009(clarify 확정). */
    public static final int CONTENT_MAX = 300;

    /** parentId는 1단 대댓글 예약분 — v1 프론트는 보내지 않는다(spec 005 R3). */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(
            @NotBlank @Size(max = CONTENT_MAX) String content,
            Long parentId
    ) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CommentResponse(
            Long id,
            Long playlistId,
            Long parentId,
            AuthorSummary author,
            String content,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static CommentResponse from(Comment c) {
            return new CommentResponse(c.getId(), c.getPlaylistId(), c.getParentId(),
                    AuthorSummary.from(c.getAuthor()), c.getContent(), c.getCreatedAt(), c.getUpdatedAt());
        }
    }
}
