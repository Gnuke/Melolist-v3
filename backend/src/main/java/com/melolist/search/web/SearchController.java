package com.melolist.search.web;

import com.melolist.music.dto.MusicResponse;
import com.melolist.search.domain.SearchMode;
import com.melolist.search.dto.DeepQuotaResponse;
import com.melolist.search.dto.DeepSelectRequest;
import com.melolist.search.dto.SearchResponse;
import com.melolist.search.dto.TextSearchRequest;
import com.melolist.search.dto.TextSelectRequest;
import com.melolist.search.service.AiQuotaService;
import com.melolist.search.service.DeepSearchService;
import com.melolist.search.service.SearchService;
import com.melolist.search.service.TextSearchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.format.DateTimeFormatter;
import java.util.UUID;

/**
 * 음악 검색 — 게스트 허용(인증 불요), multipart {@code audio}.
 * JWT가 있으면 검색 기록을 남기고, X-Session-Id가 있으면 계측에 사용한다.
 *
 * <p>AI 자연어 폴백(spec 002): {@code /text}는 X-Session-Id가 필수다 —
 * 게스트 일일 한도(quota)의 키이기 때문. 누락 시 400(전역 핸들러).</p>
 */
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;
    private final TextSearchService textSearchService;
    private final DeepSearchService deepSearchService;
    private final AiQuotaService aiQuotaService;

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

    /** AI 자연어 폴백 검색(spec 002) — 후보 최대 5곡, 저장 없음. */
    @PostMapping("/text")
    public SearchResponse text(
            @Valid @RequestBody TextSearchRequest request,
            @RequestHeader("X-Session-Id") UUID sessionId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return textSearchService.searchByText(request.query(), sessionId, jwt);
    }

    /** AI 폴백 후보 선택 확정 — 유일한 저장 시점(upsert + 기록 + 계측). */
    @PostMapping("/text/select")
    public MusicResponse textSelect(
            @Valid @RequestBody TextSelectRequest request,
            @RequestHeader("X-Session-Id") UUID sessionId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return textSearchService.select(request, sessionId, jwt);
    }

    // ── 웹검색 심층 탐색(spec 004) — 로그인 전용(SecurityConfig), 429 메시지는 심층 문구 분기 ──

    /** 잔여 횟수 조회 — 확인 단계 UI 원천(FR-002). */
    @GetMapping("/deep/quota")
    public DeepQuotaResponse deepQuota(@AuthenticationPrincipal Jwt jwt) {
        AiQuotaService.DeepUsage usage = aiQuotaService.deepUsage(UUID.fromString(jwt.getSubject()));
        return new DeepQuotaResponse(usage.limit(), usage.used(), usage.remaining(),
                usage.resetAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
    }

    /** 심층 탐색 실행 — 후보 최대 5곡(미확인 라벨 포함), 저장 없음. */
    @PostMapping("/deep")
    public SearchResponse deep(
            @Valid @RequestBody TextSearchRequest request,
            @RequestHeader("X-Session-Id") UUID sessionId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return deepSearchService.search(request.query(), sessionId, jwt);
    }

    /** 심층 후보 선택 확정 — upsert(source=WEB) + 기록(DEEP) + 계측. */
    @PostMapping("/deep/select")
    public MusicResponse deepSelect(
            @Valid @RequestBody DeepSelectRequest request,
            @RequestHeader("X-Session-Id") UUID sessionId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return deepSearchService.select(request, sessionId, jwt);
    }
}
