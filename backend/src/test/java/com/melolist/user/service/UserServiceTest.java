package com.melolist.user.service;

import com.melolist.user.domain.Profile;
import com.melolist.user.dto.ProfileResponse;
import com.melolist.user.dto.UpdateMeRequest;
import com.melolist.user.repository.ProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

/** M3 프로필 수정 — PATCH 부분 수정 시맨틱(null=유지)과 검증 규칙. */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();

    @Mock
    private ProfileRepository profileRepository;

    @InjectMocks
    private UserService service;

    private Profile profile;
    private Jwt jwt;

    @BeforeEach
    void setUp() {
        profile = new Profile(USER_ID, "user@test.com", "기존별명");
        profile.setAvatarUrl("https://old.example/avatar.jpg");
        jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .subject(USER_ID.toString())
                .build();
        when(profileRepository.findById(USER_ID)).thenReturn(Optional.of(profile));
    }

    @Test
    void 별명은_트림해_반영하고_null_필드는_유지한다() {
        ProfileResponse res = service.updateMe(jwt, new UpdateMeRequest("  새별명  ", null));

        assertThat(res.displayName()).isEqualTo("새별명");
        assertThat(res.avatarUrl()).isEqualTo("https://old.example/avatar.jpg");
    }

    @Test
    void 아바타_URL을_수정한다() {
        ProfileResponse res = service.updateMe(jwt, new UpdateMeRequest(null, "https://new.example/a.jpg"));

        assertThat(res.displayName()).isEqualTo("기존별명");
        assertThat(res.avatarUrl()).isEqualTo("https://new.example/a.jpg");
    }

    @Test
    void 공백_별명은_400이다() {
        assertThatThrownBy(() -> service.updateMe(jwt, new UpdateMeRequest("   ", null)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(profile.getDisplayName()).isEqualTo("기존별명");
    }

    @Test
    void 아바타는_https_URL만_허용한다() {
        assertThatThrownBy(() -> service.updateMe(jwt, new UpdateMeRequest(null, "http://insecure.example/a.jpg")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(profile.getAvatarUrl()).isEqualTo("https://old.example/avatar.jpg");
    }
}
