package com.melolist.admin.service;

import com.melolist.admin.domain.AdminAuditLog;
import com.melolist.admin.dto.AdminUserDtos.UserAdminItem;
import com.melolist.admin.error.InvalidAdminArgumentException;
import com.melolist.admin.error.SelfDemotionForbiddenException;
import com.melolist.admin.repository.AdminStatsRepository;
import com.melolist.common.error.NotFoundException;
import com.melolist.user.domain.Profile;
import com.melolist.user.repository.ProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** US3 역할 변경(front 계약 §5) — ADMIN|USER 검증·자기 해제 409·감사 기록·멱등. */
@ExtendWith(MockitoExtension.class)
class AdminUserServiceTest {

    private static final UUID ADMIN_ID = UUID.randomUUID();
    private static final UUID TARGET_ID = UUID.randomUUID();

    @Mock
    private ProfileRepository profileRepository;
    @Mock
    private AdminStatsRepository adminStatsRepository;
    @Mock
    private AdminAuditService adminAuditService;

    @InjectMocks
    private AdminUserService service;

    private Profile profile(UUID id, String role) {
        Profile p = new Profile(id, id + "@example.com", "닉");
        p.setRole(role);
        return p;
    }

    @Test
    void 승격하면_역할이_바뀌고_감사가_남는다() {
        Profile target = profile(TARGET_ID, "USER");
        when(profileRepository.findById(TARGET_ID)).thenReturn(Optional.of(target));

        UserAdminItem result = service.changeRole(ADMIN_ID, TARGET_ID, "ADMIN");

        assertThat(result.role()).isEqualTo("ADMIN");
        assertThat(target.getRole()).isEqualTo("ADMIN");
        verify(adminAuditService).record(eq(ADMIN_ID), eq(AdminAuditLog.ACTION_ROLE_CHANGE),
                eq("PROFILE"), eq(TARGET_ID.toString()), anyMap(), anyMap());
    }

    @Test
    void 자기_자신의_ADMIN_해제는_409다() {
        Profile self = profile(ADMIN_ID, "ADMIN");
        when(profileRepository.findById(ADMIN_ID)).thenReturn(Optional.of(self));

        assertThatThrownBy(() -> service.changeRole(ADMIN_ID, ADMIN_ID, "USER"))
                .isInstanceOf(SelfDemotionForbiddenException.class);
        assertThat(self.getRole()).isEqualTo("ADMIN");
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void 허용_외_역할_값은_거부한다() {
        assertThatThrownBy(() -> service.changeRole(ADMIN_ID, TARGET_ID, "SUPERUSER"))
                .isInstanceOf(InvalidAdminArgumentException.class);
        assertThatThrownBy(() -> service.changeRole(ADMIN_ID, TARGET_ID, null))
                .isInstanceOf(InvalidAdminArgumentException.class);
    }

    @Test
    void 같은_역할로의_변경은_멱등이고_감사를_남기지_않는다() {
        Profile target = profile(TARGET_ID, "ADMIN");
        when(profileRepository.findById(TARGET_ID)).thenReturn(Optional.of(target));

        UserAdminItem result = service.changeRole(ADMIN_ID, TARGET_ID, "ADMIN");

        assertThat(result.role()).isEqualTo("ADMIN");
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any(), any());
    }

    @Test
    void 없는_사용자는_404다() {
        when(profileRepository.findById(TARGET_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.changeRole(ADMIN_ID, TARGET_ID, "ADMIN"))
                .isInstanceOf(NotFoundException.class);
    }
}
