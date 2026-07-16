package com.melolist.search.web;

import com.melolist.auth.CurrentUser;
import com.melolist.common.dto.PageResponse;
import com.melolist.search.dto.SearchHistoryResponse;
import com.melolist.search.service.SearchHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 내 검색 기록(M3, C4) — 전부 인증 필수(SecurityConfig anyRequest에 걸림). */
@RestController
@RequestMapping("/api/search/history")
@RequiredArgsConstructor
public class SearchHistoryController {

    private final SearchHistoryService searchHistoryService;

    @GetMapping
    public PageResponse<SearchHistoryResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return searchHistoryService.getPage(CurrentUser.id(jwt), PageRequest.of(page, Math.min(size, 50)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        searchHistoryService.remove(CurrentUser.id(jwt), id);
    }
}
