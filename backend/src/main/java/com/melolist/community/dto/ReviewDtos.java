package com.melolist.community.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.community.domain.Review;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public final class ReviewDtos {

    private ReviewDtos() {
    }

    /** 내용 상한 500자 — spec 005 FR-009(clarify 확정). */
    public static final int CONTENT_MAX = 500;

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record CreateRequest(
            @NotNull @Min(1) @Max(5) Short rating,
            @NotBlank @Size(max = CONTENT_MAX) String content
    ) {
    }

    /** PATCH 부분 수정 — null 필드는 변경하지 않는다. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record UpdateRequest(
            @Min(1) @Max(5) Short rating,
            @Size(max = CONTENT_MAX) String content
    ) {
    }

    /** 리뷰 유도 노출 자격(spec 005 FR-010) — 서버 권위 판정 결과. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record PromptResponse(boolean eligible) {
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
