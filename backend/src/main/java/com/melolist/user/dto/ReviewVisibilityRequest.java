package com.melolist.user.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import jakarta.validation.constraints.NotBlank;

/**
 * 리뷰 유도 노출 상태 변경(spec 005 R6 — PATCH /users/me/review-visibility).
 * v1 액션은 "later"(유예)뿐 — enum 확장 여지로 문자열 액션을 쓴다.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ReviewVisibilityRequest(@NotBlank String action) {

    public static final String ACTION_LATER = "later";
}
