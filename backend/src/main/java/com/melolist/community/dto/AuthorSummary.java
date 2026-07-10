package com.melolist.community.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.user.domain.Profile;

import java.util.UUID;

/** 리뷰·댓글에 노출하는 작성자 요약. */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record AuthorSummary(UUID id, String displayName, String avatarUrl) {

    public static AuthorSummary from(Profile p) {
        return new AuthorSummary(p.getId(), p.getDisplayName(), p.getAvatarUrl());
    }
}
