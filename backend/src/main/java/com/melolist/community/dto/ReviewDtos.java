package com.melolist.community.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.community.domain.Review;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public final class ReviewDtos {

    private ReviewDtos() {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(
            @NotNull @Min(1) @Max(5) Short rating,
            @NotBlank String content
    ) {
    }

    /** PATCH 부분 수정 — null 필드는 변경하지 않는다. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record UpdateRequest(
            @Min(1) @Max(5) Short rating,
            String content
    ) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ReviewResponse(
            Long id,
            AuthorSummary author,
            short rating,
            String content,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static ReviewResponse from(Review r) {
            return new ReviewResponse(r.getId(), AuthorSummary.from(r.getAuthor()),
                    r.getRating(), r.getContent(), r.getCreatedAt(), r.getUpdatedAt());
        }
    }
}
