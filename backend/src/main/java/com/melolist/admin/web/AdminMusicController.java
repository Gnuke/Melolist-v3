package com.melolist.admin.web;

import com.melolist.admin.dto.AdminMusicDtos.MusicAdminItem;
import com.melolist.admin.dto.AdminMusicDtos.MusicDetail;
import com.melolist.admin.dto.AdminMusicDtos.UpdateRequest;
import com.melolist.admin.service.AdminMusicService;
import com.melolist.auth.CurrentUser;
import com.melolist.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 곡 관리(front 계약 §2·§3). 변경 작업의 수행자 ID는 감사 기록용으로 서비스에 전달한다. */
@RestController
@RequestMapping("/api/admin/music")
@RequiredArgsConstructor
public class AdminMusicController {

    private final AdminMusicService adminMusicService;

    @GetMapping
    public PageResponse<MusicAdminItem> list(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String missing,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return adminMusicService.list(query, missing, PageRequest.of(page, Math.min(size, 100)));
    }

    @GetMapping("/{id}")
    public MusicDetail get(@PathVariable Long id) {
        return adminMusicService.get(id);
    }

    @PatchMapping("/{id}")
    public MusicAdminItem update(@AuthenticationPrincipal Jwt jwt,
                                 @PathVariable Long id,
                                 @RequestBody UpdateRequest request) {
        return adminMusicService.update(CurrentUser.id(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        adminMusicService.delete(CurrentUser.id(jwt), id);
    }
}
