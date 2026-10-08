package com.melolist.community.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.ConflictException;
import com.melolist.common.error.ForbiddenException;
import com.melolist.common.error.NotFoundException;
import com.melolist.community.config.ReviewProperties;
import com.melolist.community.domain.Review;
import com.melolist.community.dto.ReviewDtos.CreateRequest;
import com.melolist.community.dto.ReviewDtos.PromptResponse;
import com.melolist.community.dto.ReviewDtos.ReviewResponse;
import com.melolist.community.dto.ReviewDtos.UpdateRequest;
import com.melolist.community.repository.ReviewRepository;
import com.melolist.search.service.SearchHistoryService;
import com.melolist.user.domain.Profile;
import com.melolist.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 서비스 리뷰 — 1인 1건. 이미 있으면 409로 응답해 "수정"을 유도한다(PRD §9.3).
 */
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final UserService userService;
    private final SearchHistoryService searchHistoryService;
    private final ReviewProperties reviewProperties;

    /**
     * 리뷰 유도 노출 자격(spec 005 FR-010) — 리뷰 미작성 AND 유예 아님 AND 누적 검색
     * 임계 이상. 서버 판정이라 기기와 무관하게 일관된다(R5). JIT 프로비저닝 겸용이라
     * readOnly가 아니다.
     */
    @Transactional
    public PromptResponse promptEligibility(Jwt jwt) {
        Profile profile = userService.getOrProvisionProfile(jwt);
        if (reviewRepository.existsByAuthorId(profile.getId())) {
            return new PromptResponse(false);
        }
        Instant hideUntil = profile.getReviewHideUntil();
        if (hideUntil != null && hideUntil.isAfter(Instant.now())) {
            return new PromptResponse(false);
        }
        long searches = searchHistoryService.countByUser(profile.getId());
        return new PromptResponse(searches >= reviewProperties.promptSearchThreshold());
    }

    @Transactional(readOnly = true)
    public PageResponse<ReviewResponse> getPage(Pageable pageable) {
        return PageResponse.of(reviewRepository.findAllByOrderByCreatedAtDesc(pageable), ReviewResponse::from);
    }

    @Transactional(readOnly = true)
    public ReviewResponse get(Long id) {
        return ReviewResponse.from(find(id));
    }

    @Transactional(readOnly = true)
    public ReviewResponse getMine(UUID userId) {
        return reviewRepository.findByAuthorId(userId)
                .map(ReviewResponse::from)
                .orElseThrow(() -> new NotFoundException("작성한 리뷰가 없습니다."));
    }

    @Transactional
    public ReviewResponse create(Jwt jwt, CreateRequest request) {
        Profile author = userService.getOrProvisionProfile(jwt);
        if (reviewRepository.existsByAuthorId(author.getId())) {
            throw new ConflictException("이미 작성한 리뷰가 있습니다. 기존 리뷰를 수정해 주세요.");
        }
        try {
            return ReviewResponse.from(
                    reviewRepository.save(new Review(author, request.rating(), request.content())));
        } catch (DataIntegrityViolationException e) {
            // 동시 요청이 unique(user_id)에 먼저 도달한 경우
            throw new ConflictException("이미 작성한 리뷰가 있습니다. 기존 리뷰를 수정해 주세요.");
        }
    }

    @Transactional
    public ReviewResponse update(Long id, UUID userId, UpdateRequest request) {
        Review review = findOwned(id, userId);
        if (request.rating() != null) {
            review.setRating(request.rating());
        }
        if (request.content() != null) {
            review.setContent(request.content());
        }
        return ReviewResponse.from(review);
    }

    @Transactional
    public void delete(Long id, UUID userId) {
        reviewRepository.delete(findOwned(id, userId));
    }

    private Review find(Long id) {
        return reviewRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("리뷰를 찾을 수 없습니다."));
    }

    private Review findOwned(Long id, UUID userId) {
        Review review = find(id);
        if (!review.getAuthor().getId().equals(userId)) {
            throw new ForbiddenException("리뷰 작성자만 변경할 수 있습니다.");
        }
        return review;
    }
}
