package com.melolist.user.web;

import com.melolist.user.dto.ProfileResponse;
import com.melolist.user.dto.UpdateMeRequest;
import com.melolist.user.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    /**
     * 내 프로필 조회. 최초 호출 시 profiles 레코드를 JIT 생성한다. (PRD M1 산출물)
     */
    @GetMapping("/me")
    public ProfileResponse me(@AuthenticationPrincipal Jwt jwt) {
        return userService.getOrProvision(jwt);
    }

    /** 내 프로필 부분 수정(M3 프로필 화면) — 별명·아바타 URL. */
    @PatchMapping("/me")
    public ProfileResponse updateMe(@Valid @RequestBody UpdateMeRequest request,
                                    @AuthenticationPrincipal Jwt jwt) {
        return userService.updateMe(jwt, request);
    }
}
