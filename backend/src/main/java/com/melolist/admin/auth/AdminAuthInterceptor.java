package com.melolist.admin.auth;

import com.melolist.common.error.ForbiddenException;
import com.melolist.user.repository.ProfileRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.UUID;

/**
 * {@code /api/admin/**} 인가 — profiles.role이 ADMIN인 로그인 사용자만 통과(spec 003 FR-001).
 *
 * <p>게스트(무토큰)는 SecurityConfig의 {@code anyRequest().authenticated()}가 401로
 * 선차단하므로, 여기서는 역할만 판정한다. 역할은 JWT 클레임이 아닌 DB(profiles.role)
 * 기준으로 매 요청 판정한다 — 역할 회수가 다음 요청부터 즉시 반영된다(research D1).
 * 거부는 기존 {@link ForbiddenException}으로 던져 표준 403 바디로 변환된다.</p>
 */
@Component
@RequiredArgsConstructor
public class AdminAuthInterceptor implements HandlerInterceptor {

    private final ProfileRepository profileRepository;

    @Override
    public boolean preHandle(@NonNull HttpServletRequest request,
                             @NonNull HttpServletResponse response,
                             @NonNull Object handler) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Jwt jwt)) {
            throw new ForbiddenException("관리자 권한이 필요합니다.");
        }
        UUID userId = UUID.fromString(jwt.getSubject());
        boolean admin = profileRepository.findById(userId)
                .map(profile -> "ADMIN".equals(profile.getRole()))
                .orElse(false);
        if (!admin) {
            throw new ForbiddenException("관리자 권한이 필요합니다.");
        }
        return true;
    }
}
