package com.melolist.admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.community.domain.Review;
import com.melolist.user.domain.Profile;

import java.time.Instant;
import java.util.UUID;

/** 모더레이션 계약(contracts §4) — 작성자 식별(이메일)을 포함하는 admin 전용 리뷰 목록. */
public final class AdminModerationDtos {

    private AdminModerationDtos() {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record ReviewAuthor(UUID id, String email, String displayName) {
        public static ReviewAuthor from(Profile p) {
            return new ReviewAuthor(p.getId(), p.getEmail(), p.getDisplayName());
        }
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AdminReviewRow(Long id, short rating, String content, Instant createdAt, ReviewAuthor author) {
        public static AdminReviewRow from(Review r) {
            return new AdminReviewRow(r.getId(), r.getRating(), r.getContent(), r.getCreatedAt(),
                    ReviewAuthor.from(r.getAuthor()));
        }
    }
}
