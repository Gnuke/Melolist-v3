package com.melolist.user.dto;

import com.melolist.user.domain.Profile;

import java.util.UUID;

/**
 * 프로필 응답 DTO. Entity를 직접 노출하지 않는다(PRD §4.3 계약 규약).
 */
public record ProfileResponse(
        UUID id,
        String email,
        String displayName,
        String avatarUrl,
        String role
) {
    public static ProfileResponse from(Profile p) {
        return new ProfileResponse(
                p.getId(),
                p.getEmail(),
                p.getDisplayName(),
                p.getAvatarUrl(),
                p.getRole()
        );
    }
}
