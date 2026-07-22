package com.melolist.admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.admin.repository.AdminStatsRepository.ProfileRow;
import com.melolist.user.domain.Profile;

import java.time.Instant;
import java.util.UUID;

/**
 * 사용자 조회·역할 변경 계약(front 계약 §4·§5 — UserAdminItem). 노출 정보는 서비스가 이미
 * 보유한 프로필 필드로 한정한다(FR-013) — 게스트 식별 정보는 다루지 않는다.
 */
public final class AdminUserDtos {

    private AdminUserDtos() {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record UserAdminItem(
            UUID id,
            String email,
            String displayName,
            String avatarUrl,
            String role,
            Instant createdAt
    ) {
        public static UserAdminItem from(ProfileRow row) {
            return new UserAdminItem(row.getId(), row.getEmail(), row.getDisplayName(),
                    row.getAvatarUrl(), row.getRole(), row.getCreatedAt());
        }

        public static UserAdminItem from(Profile p) {
            return new UserAdminItem(p.getId(), p.getEmail(), p.getDisplayName(),
                    p.getAvatarUrl(), p.getRole(), p.getCreatedAt());
        }
    }

    /** 역할 변경 요청(front 계약 §5) — ADMIN | USER만 허용, 검증은 서비스에서. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record RoleUpdateRequest(String role) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Activity(long searchCount, long favoriteCount, long playlistCount, boolean hasReview) {
    }

    /** 백엔드 전용 상세(front 미사용) — 활동 요약은 집계 수치만(FR-013). */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record UserDetail(
            UUID id,
            String email,
            String displayName,
            String avatarUrl,
            String role,
            Instant createdAt,
            Activity activity
    ) {
        public static UserDetail of(Profile p, Activity activity) {
            return new UserDetail(p.getId(), p.getEmail(), p.getDisplayName(), p.getAvatarUrl(),
                    p.getRole(), p.getCreatedAt(), activity);
        }
    }
}
