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
        return profileRepository.findById(userId)
                .orElseGet(() -> provision(jwt, userId));
    }

    private Profile provision(Jwt jwt, UUID userId) {
        String email = jwt.getClaimAsString("email");
        String displayName = resolveDisplayName(jwt, email);
        return profileRepository.save(new Profile(userId, email, displayName));
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
}
