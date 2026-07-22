package com.melolist.admin.web;

import com.melolist.admin.dto.AdminUserDtos.RoleUpdateRequest;
import com.melolist.admin.dto.AdminUserDtos.UserAdminItem;
import com.melolist.admin.dto.AdminUserDtos.UserDetail;
import com.melolist.admin.service.AdminUserService;
import com.melolist.auth.CurrentUser;
import com.melolist.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** 사용자 조회·역할 변경(front 계약 §4·§5). 역할 변경은 감사 기록 대상. */
@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public PageResponse<UserAdminItem> list(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return adminUserService.list(query, PageRequest.of(page, Math.min(size, 100)));
    }

    @GetMapping("/{id}")
    public UserDetail get(@PathVariable UUID id) {
        return adminUserService.get(id);
    }

    @PatchMapping("/{id}/role")
    public UserAdminItem changeRole(@AuthenticationPrincipal Jwt jwt,
                                    @PathVariable UUID id,
                                    @RequestBody RoleUpdateRequest request) {
        return adminUserService.changeRole(CurrentUser.id(jwt), id, request.role());
    }
}
