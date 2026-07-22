package com.melolist.admin.web;

import com.melolist.admin.dto.AdminModerationDtos.AdminReviewRow;
import com.melolist.admin.service.AdminModerationService;
import com.melolist.auth.CurrentUser;
import com.melolist.common.dto.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 모더레이션(contracts §4). 변경 작업의 수행자 ID는 감사 기록용으로 서비스에 전달한다. */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminModerationController {

    private final AdminModerationService adminModerationService;

    @GetMapping("/reviews")
    public PageResponse<AdminReviewRow> reviews(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return adminModerationService.reviews(PageRequest.of(page, Math.min(size, 50)));
    }

    @DeleteMapping("/reviews/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteReview(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        adminModerationService.deleteReview(CurrentUser.id(jwt), id);
    }

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        adminModerationService.deleteComment(CurrentUser.id(jwt), id);
    }

    @PostMapping("/playlists/{id}/unpublish")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void unpublishPlaylist(@AuthenticationPrincipal Jwt jwt, @PathVariable Long id) {
        adminModerationService.unpublishPlaylist(CurrentUser.id(jwt), id);
    }
}
