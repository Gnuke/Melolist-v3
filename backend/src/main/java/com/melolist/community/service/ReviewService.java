package com.melolist.community.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.ConflictException;
import com.melolist.common.error.ForbiddenException;
import com.melolist.common.error.NotFoundException;
import com.melolist.community.domain.Review;
import com.melolist.community.dto.ReviewDtos.CreateRequest;
import com.melolist.community.dto.ReviewDtos.ReviewResponse;
import com.melolist.community.dto.ReviewDtos.UpdateRequest;
import com.melolist.community.repository.ReviewRepository;
import com.melolist.user.domain.Profile;
import com.melolist.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 서비스 리뷰 — 1인 1건. 이미 있으면 409로 응답해 "수정"을 유도한다(PRD §9.3).
 */
@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ReviewRepository reviewRepository;
    private final UserService userService;

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
