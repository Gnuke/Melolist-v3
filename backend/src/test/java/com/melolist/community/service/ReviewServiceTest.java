package com.melolist.community.service;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 서비스 리뷰 1인 1건(PRD §9.3) — 409 유도·경합 수렴·작성자 한정 수정. */
@ExtendWith(MockitoExtension.class)
class ReviewServiceTest {

    private static final Long REVIEW_ID = 11L;
    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID OTHER_ID = UUID.randomUUID();

    @Mock
    private ReviewRepository reviewRepository;
    @Mock
    private UserService userService;

    @InjectMocks
    private ReviewService reviewService;

    private final Jwt jwt = mock(Jwt.class);
    private Profile author;

    @BeforeEach
    void setUp() {
        author = mock(Profile.class);
        lenient().when(author.getId()).thenReturn(USER_ID);
        lenient().when(userService.getOrProvisionProfile(jwt)).thenReturn(author);
    }

    @Test
    void 첫_리뷰는_저장된다() {
        when(reviewRepository.existsByAuthorId(USER_ID)).thenReturn(false);
        when(reviewRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ReviewResponse response = reviewService.create(jwt, new CreateRequest((short) 5, "잘 쓰고 있어요"));

        assertThat(response.rating()).isEqualTo((short) 5);
        assertThat(response.content()).isEqualTo("잘 쓰고 있어요");
    }

    @Test
    void 이미_작성한_리뷰가_있으면_409다() {
        when(reviewRepository.existsByAuthorId(USER_ID)).thenReturn(true);

        assertThatThrownBy(() -> reviewService.create(jwt, new CreateRequest((short) 4, "두 번째 리뷰")))
                .isInstanceOf(ConflictException.class);
        verify(reviewRepository, never()).save(any());
    }

    @Test
    void 동시_요청이_unique_제약에_걸려도_409로_수렴한다() {
        when(reviewRepository.existsByAuthorId(USER_ID)).thenReturn(false);
        when(reviewRepository.save(any())).thenThrow(new DataIntegrityViolationException("dup"));

        assertThatThrownBy(() -> reviewService.create(jwt, new CreateRequest((short) 4, "경합 리뷰")))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void 작성자가_아니면_수정은_403이다() {
        when(reviewRepository.findById(REVIEW_ID)).thenReturn(Optional.of(new Review(author, (short) 5, "내 리뷰")));

        assertThatThrownBy(() -> reviewService.update(REVIEW_ID, OTHER_ID, new UpdateRequest((short) 1, null)))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void 수정_시_null_필드는_변경하지_않는다() {
        Review review = new Review(author, (short) 5, "처음 내용");
        when(reviewRepository.findById(REVIEW_ID)).thenReturn(Optional.of(review));

        ReviewResponse response = reviewService.update(REVIEW_ID, USER_ID, new UpdateRequest(null, "고친 내용"));

        assertThat(response.rating()).isEqualTo((short) 5);
        assertThat(response.content()).isEqualTo("고친 내용");
    }

    @Test
    void 작성한_리뷰가_없으면_getMine은_404다() {
        when(reviewRepository.findByAuthorId(USER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> reviewService.getMine(USER_ID))
                .isInstanceOf(NotFoundException.class);
    }
}
