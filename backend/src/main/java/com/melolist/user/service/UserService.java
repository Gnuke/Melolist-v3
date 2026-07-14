package com.melolist.user.service;

import com.melolist.user.domain.Profile;
import com.melolist.user.dto.ProfileResponse;
import com.melolist.user.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final ProfileRepository profileRepository;

    /**
     * 현재 JWT에 해당하는 프로필을 반환하되, 없으면 JIT 프로비저닝한다.
     * Supabase JWT의 {@code sub}=사용자 UUID, {@code email}=이메일.
     */
    @Transactional
    public ProfileResponse getOrProvision(Jwt jwt) {
        return ProfileResponse.from(getOrProvisionProfile(jwt));
    }

    /**
     * 엔티티 버전 — 다른 도메인이 Profile FK 참조(리뷰·댓글 작성 등) 전에 JIT 보장을
     * 겸해 호출한다. 외부 응답에는 DTO 버전을 쓴다.
     */
    @Transactional
    public Profile getOrProvisionProfile(Jwt jwt) {
        UUID userId = UUID.fromString(jwt.getSubject());
        Profile profile = profileRepository.findById(userId)
                .orElseGet(() -> provision(jwt, userId));
        if (profile.getAvatarUrl() == null) {
            // avatar 없이 프로비저닝된 기존 행 자가 치유 (dirty checking으로 반영)
            profile.setAvatarUrl(resolveAvatarUrl(jwt));
        }
        return profile;
    }

    private Profile provision(Jwt jwt, UUID userId) {
        String email = jwt.getClaimAsString("email");
        String displayName = resolveDisplayName(jwt, email);
        Profile profile = new Profile(userId, email, displayName);
        profile.setAvatarUrl(resolveAvatarUrl(jwt));
        return profileRepository.save(profile);
    }

    /** Supabase user_metadata.full_name → name → 이메일 local-part 순으로 표시명 결정. */
    private String resolveDisplayName(Jwt jwt, String email) {
        Object metadata = jwt.getClaim("user_metadata");
        if (metadata instanceof java.util.Map<?, ?> meta) {
            Object fullName = meta.get("full_name");
            if (fullName == null) {
                fullName = meta.get("name");
            }
            if (fullName != null) {
                return fullName.toString();
            }
        }
        if (email != null && email.contains("@")) {
            return email.substring(0, email.indexOf('@'));
        }
        return null;
    }

    /** Supabase user_metadata.avatar_url → picture 순으로 프로필 이미지 결정 (FR-010 최소 수집 3종). */
    private String resolveAvatarUrl(Jwt jwt) {
        Object metadata = jwt.getClaim("user_metadata");
        if (metadata instanceof java.util.Map<?, ?> meta) {
            Object url = meta.get("avatar_url");
            if (url == null) {
                url = meta.get("picture");
            }
            if (url != null) {
                return url.toString();
            }
        }
        return null;
    }
}
