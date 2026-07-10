package com.melolist.community.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.community.domain.Comment;
import jakarta.validation.constraints.NotBlank;

import java.time.Instant;

public final class CommentDtos {

    private CommentDtos() {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(
            @NotBlank String content,
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
