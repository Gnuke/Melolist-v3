package com.melolist.admin.auth;

import com.melolist.common.error.ForbiddenException;
import com.melolist.user.domain.Profile;
import com.melolist.user.repository.ProfileRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** /api/admin/** 인가 — ADMIN 역할만 통과, 역할은 매 요청 DB 재판정(spec 003 FR-001·SC-003). */
@ExtendWith(MockitoExtension.class)
class AdminAuthInterceptorTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock
    private ProfileRepository profileRepository;

    @InjectMocks
    private AdminAuthInterceptor interceptor;

    private final HttpServletRequest request = mock(HttpServletRequest.class);
    private final HttpServletResponse response = mock(HttpServletResponse.class);

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void authenticateAs(UUID userId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(userId.toString())
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    private Profile profileWithRole(String role) {
        Profile profile = mock(Profile.class);
        when(profile.getRole()).thenReturn(role);
        return profile;
    }

    @Test
    void ADMIN_역할이면_통과한다() {
        authenticateAs(USER_ID);
        Profile admin = profileWithRole("ADMIN");
        when(profileRepository.findById(USER_ID)).thenReturn(Optional.of(admin));

        assertThat(interceptor.preHandle(request, response, new Object())).isTrue();
    }

    @Test
    void 일반_사용자는_Forbidden이다() {
        authenticateAs(USER_ID);
        Profile user = profileWithRole("USER");
        when(profileRepository.findById(USER_ID)).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void 프로필이_없으면_Forbidden이다() {
        authenticateAs(USER_ID);
        when(profileRepository.findById(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void 인증_정보가_없으면_Forbidden이다() {
        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void 역할은_매_요청_저장소에서_재판정된다_회수_즉시_반영() {
        authenticateAs(USER_ID);
        Profile admin = profileWithRole("ADMIN");
        Profile revoked = profileWithRole("USER");
        when(profileRepository.findById(USER_ID))
                .thenReturn(Optional.of(admin))
                .thenReturn(Optional.of(revoked));

        assertThat(interceptor.preHandle(request, response, new Object())).isTrue();
        assertThatThrownBy(() -> interceptor.preHandle(request, response, new Object()))
                .isInstanceOf(ForbiddenException.class);
        verify(profileRepository, times(2)).findById(USER_ID);
    }
}
