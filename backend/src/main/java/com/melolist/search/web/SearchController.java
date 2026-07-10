package com.melolist.search.web;

import com.melolist.search.domain.SearchMode;
import com.melolist.search.dto.SearchResponse;
import com.melolist.search.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * 음악 검색 — 게스트 허용(인증 불요), multipart {@code audio}.
 * JWT가 있으면 검색 기록을 남기고, X-Session-Id가 있으면 계측에 사용한다.
 */
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @PostMapping(value = "/fingerprint", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SearchResponse fingerprint(
            @RequestPart("audio") MultipartFile audio,
            @RequestHeader(value = "X-Session-Id", required = false) UUID sessionId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return searchService.search(SearchMode.FINGERPRINT, audio, sessionId, jwt);
    }

    @PostMapping(value = "/humming", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public SearchResponse humming(
            @RequestPart("audio") MultipartFile audio,
            @RequestHeader(value = "X-Session-Id", required = false) UUID sessionId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return searchService.search(SearchMode.HUMMING, audio, sessionId, jwt);
    }
}
