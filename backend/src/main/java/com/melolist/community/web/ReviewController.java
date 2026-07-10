package com.melolist.community.web;

import com.melolist.auth.CurrentUser;
import com.melolist.common.dto.PageResponse;
import com.melolist.community.dto.ReviewDtos.CreateRequest;
import com.melolist.community.dto.ReviewDtos.ReviewResponse;
import com.melolist.community.dto.ReviewDtos.UpdateRequest;
import com.melolist.community.service.ReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 서비스 리뷰 API(PRD §7 community). 조회는 게스트 허용, 작성은 1인 1건(중복 409).
 */
@RestController
@RequestMapping("/api/reviews")
@RequiredArgsConstructor
public class ReviewController {

    private final ReviewService reviewService;

    @GetMapping
    public PageResponse<ReviewResponse> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return reviewService.getPage(PageRequest.of(page, Math.min(size, 50)));
    }

    /** /me가 /{id} 패턴에 삼켜지지 않도록 먼저 선언한다. */
    @GetMapping("/me")
    public ReviewResponse mine(@AuthenticationPrincipal Jwt jwt) {
        return reviewService.getMine(CurrentUser.id(jwt));
    }

    @GetMapping("/{id}")
    public ReviewResponse get(@PathVariable Long id) {
        return reviewService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ReviewResponse create(@Valid @RequestBody CreateRequest request,
                                 @AuthenticationPrincipal Jwt jwt) {
        return reviewService.create(jwt, request);
    }

    @PatchMapping("/{id}")
    public ReviewResponse update(@PathVariable Long id,
                                 @Valid @RequestBody UpdateRequest request,
                                 @AuthenticationPrincipal Jwt jwt) {
        return reviewService.update(id, CurrentUser.id(jwt), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        reviewService.delete(id, CurrentUser.id(jwt));
    }
}
