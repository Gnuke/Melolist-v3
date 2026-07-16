package com.melolist.community.web;

import com.melolist.auth.CurrentUser;
import com.melolist.common.dto.PageResponse;
import com.melolist.community.dto.FavoriteDtos.AddRequest;
import com.melolist.community.dto.FavoriteDtos.FavoriteResponse;
import com.melolist.community.service.FavoriteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 곡 즐겨찾기 API(PRD §7 community) — 전부 인증 필수. */
@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteService favoriteService;

    @GetMapping
    public PageResponse<FavoriteResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return favoriteService.getPage(CurrentUser.id(jwt), PageRequest.of(page, Math.min(size, 50)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FavoriteResponse add(@Valid @RequestBody AddRequest request, @AuthenticationPrincipal Jwt jwt) {
        return favoriteService.add(jwt, request.musicId(), request.acrid());
    }

    @DeleteMapping("/{musicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable Long musicId, @AuthenticationPrincipal Jwt jwt) {
        favoriteService.remove(CurrentUser.id(jwt), musicId);
    }
}
