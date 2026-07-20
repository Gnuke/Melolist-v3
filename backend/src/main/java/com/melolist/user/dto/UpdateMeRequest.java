package com.melolist.user.dto;

import jakarta.validation.constraints.Size;

/**
 * PATCH /api/users/me 요청 — null 필드는 변경하지 않는다.
 * user 도메인은 M1 계약 보존으로 camelCase(§4.3의 예외, ProfileResponse와 동일).
 */
public record UpdateMeRequest(
        @Size(max = 30) String displayName,
        @Size(max = 500) String avatarUrl
) {
}
