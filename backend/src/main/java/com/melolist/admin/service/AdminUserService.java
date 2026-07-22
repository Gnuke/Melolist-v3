package com.melolist.admin.service;

import com.melolist.admin.domain.AdminAuditLog;
import com.melolist.admin.dto.AdminUserDtos.Activity;
import com.melolist.admin.dto.AdminUserDtos.UserAdminItem;
import com.melolist.admin.dto.AdminUserDtos.UserDetail;
import com.melolist.admin.error.InvalidAdminArgumentException;
import com.melolist.admin.error.SelfDemotionForbiddenException;
import com.melolist.admin.repository.AdminStatsRepository;
import com.melolist.admin.repository.AdminStatsRepository.ProfileRow;
import com.melolist.admin.repository.AdminStatsRepository.UserActivityRow;
import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.NotFoundException;
import com.melolist.user.domain.Profile;
import com.melolist.user.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 사용자 조회·역할 변경(US3, front 계약 §4·§5). 역할 변경은 ADMIN 전용 경로에서만 가능하고
 * (일반 사용자 셀프 승격 불가 — FR-002 개정), 자기 자신의 ADMIN 해제는 409로 차단한다
 * (관리자 0명 사태 방지). 최초 관리자 부트스트랩은 여전히 DB 수동 지정이다.
 */
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private static final Set<String> ALLOWED_ROLES = Set.of("ADMIN", "USER");

    private final ProfileRepository profileRepository;
    private final AdminStatsRepository adminStatsRepository;
    private final AdminAuditService adminAuditService;

    @Transactional(readOnly = true)
    public PageResponse<UserAdminItem> list(String query, Pageable pageable) {
        Page<ProfileRow> page = (query == null || query.isBlank())
                ? adminStatsRepository.listUsers(pageable)
                : adminStatsRepository.searchUsers(query.trim(), pageable);
        return PageResponse.of(page, UserAdminItem::from);
    }

    @Transactional(readOnly = true)
    public UserDetail get(UUID id) {
        Profile profile = find(id);
        UserActivityRow row = adminStatsRepository.userActivity(id);
        Activity activity = new Activity(
                zero(row.getSearchCount()),
                zero(row.getFavoriteCount()),
                zero(row.getPlaylistCount()),
                Boolean.TRUE.equals(row.getHasReview())
        );
        return UserDetail.of(profile, activity);
    }

    @Transactional
    public UserAdminItem changeRole(UUID adminId, UUID targetId, String role) {
        if (role == null || !ALLOWED_ROLES.contains(role)) {
            throw new InvalidAdminArgumentException("role", "role은 ADMIN 또는 USER만 허용됩니다.");
        }
        Profile target = find(targetId);
        if (targetId.equals(adminId) && "USER".equals(role)) {
            throw new SelfDemotionForbiddenException();
        }
        if (role.equals(target.getRole())) {
            return UserAdminItem.from(target); // 변화 없음 — 멱등, 감사 기록 생략
        }
        String beforeRole = target.getRole();
        target.setRole(role);
        adminAuditService.record(adminId, AdminAuditLog.ACTION_ROLE_CHANGE, "PROFILE",
                targetId.toString(), Map.of("role", beforeRole), Map.of("role", role));
        return UserAdminItem.from(target);
    }

    private Profile find(UUID id) {
        return profileRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("사용자를 찾을 수 없습니다."));
    }

    private long zero(Long value) {
        return value == null ? 0L : value;
    }
}
