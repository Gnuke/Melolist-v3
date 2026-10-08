package com.melolist.user.service;

import com.melolist.community.config.ReviewProperties;
import com.melolist.user.domain.Profile;
import com.melolist.user.dto.ProfileResponse;
import com.melolist.user.dto.ReviewVisibilityRequest;
import com.melolist.user.dto.UpdateMeRequest;
import com.melolist.user.repository.ProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final ProfileRepository profileRepository;
    // 유예 일수는 리뷰 도메인 정책(community.config) — 상태(review_hide_until)만 프로필 소유
    private final ReviewProperties reviewProperties;

    /**
     * 리뷰 유도 유예(spec 005 FR-010) — "나중에" 선택 시 서버에 만료 시각을 저장해
     * 기기와 무관하게 유예 기간 동안 재노출하지 않는다. 알 수 없는 action은 400.
     */
    @Transactional
    public void applyReviewVisibility(Jwt jwt, ReviewVisibilityRequest request) {
        if (!ReviewVisibilityRequest.ACTION_LATER.equals(request.action())) {
            throw new IllegalArgumentException("지원하지 않는 action입니다.");
        }
        Profile profile = getOrProvisionProfile(jwt);
        profile.setReviewHideUntil(Instant.now().plus(Duration.ofDays(reviewProperties.promptDeferDays())));
    }

    /** 프로필 일괄 조회 — 커뮤니티 피드 작성자 요약 등 페이지 단위 조인용(N+1 방지). */
    @Transactional(readOnly = true)
    public Map<UUID, Profile> getProfileMap(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Map.of();
        }
        return profileRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Profile::getId, Function.identity()));
    }

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

    /**
     * 내 프로필 부분 수정(M3 프로필 화면) — null 필드는 유지. 별명은 공백 불가,
     * 아바타는 https URL만(업로드 자체는 프론트가 Storage에 직접, 여기는 URL 저장만).
     */
    @Transactional
    public ProfileResponse updateMe(Jwt jwt, UpdateMeRequest request) {
        Profile profile = getOrProvisionProfile(jwt);
        if (request.displayName() != null) {
            String name = request.displayName().trim();
            if (name.isEmpty()) {
                throw new IllegalArgumentException("별명은 비울 수 없습니다.");
            }
            profile.setDisplayName(name);
        }
        if (request.avatarUrl() != null) {
            if (!request.avatarUrl().startsWith("https://")) {
                throw new IllegalArgumentException("avatarUrl은 https URL이어야 합니다.");
            }
            profile.setAvatarUrl(request.avatarUrl());
        }
        return ProfileResponse.from(profile);
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
