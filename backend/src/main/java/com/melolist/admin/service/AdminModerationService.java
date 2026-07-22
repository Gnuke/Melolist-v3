package com.melolist.admin.service;

import com.melolist.admin.domain.AdminAuditLog;
import com.melolist.admin.dto.AdminModerationDtos.AdminReviewRow;
import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.NotFoundException;
import com.melolist.community.domain.Comment;
import com.melolist.community.domain.Review;
import com.melolist.community.repository.CommentRepository;
import com.melolist.community.repository.ReviewRepository;
import com.melolist.playlist.domain.Playlist;
import com.melolist.playlist.repository.PlaylistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 모더레이션(US3) — 리뷰·댓글 삭제, 공개 플레이리스트 비공개 전환.
 * 기존 사용자 삭제 경로는 소유자 검증이 박혀 있어 리포지토리 수준에서 동일 의미론으로
 * 수행한다(research D7): 댓글 삭제는 대댓글 동반, 플레이리스트는 전환만(삭제 없음).
 * 모든 조치는 감사 기록과 같은 트랜잭션이다(FR-011).
 */
@Service
@RequiredArgsConstructor
public class AdminModerationService {

    private final ReviewRepository reviewRepository;
    private final CommentRepository commentRepository;
    private final PlaylistRepository playlistRepository;
    private final AdminAuditService adminAuditService;

    @Transactional(readOnly = true)
    public PageResponse<AdminReviewRow> reviews(Pageable pageable) {
        return PageResponse.of(reviewRepository.findAllByOrderByCreatedAtDesc(pageable), AdminReviewRow::from);
    }

    /** 삭제되면 작성자는 1인 1리뷰 규칙상 새 리뷰를 다시 작성할 수 있다(spec US3-2). */
    @Transactional
    public void deleteReview(UUID adminId, Long id) {
        Review review = reviewRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("리뷰를 찾을 수 없습니다."));
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("author_id", review.getAuthor().getId().toString());
        before.put("rating", review.getRating());
        before.put("content", review.getContent());

        reviewRepository.delete(review);
        adminAuditService.record(adminId, AdminAuditLog.ACTION_REVIEW_DELETE, "REVIEW",
                String.valueOf(id), before, null);
    }

    /** 대댓글 동반 삭제 — 작성자 본인 삭제와 동일한 기존 규칙(spec FR-010). */
    @Transactional
    public void deleteComment(UUID adminId, Long id) {
        Comment comment = commentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("댓글을 찾을 수 없습니다."));
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("author_id", comment.getAuthor().getId().toString());
        before.put("playlist_id", comment.getPlaylistId());
        before.put("parent_id", comment.getParentId());
        before.put("content", comment.getContent());

        commentRepository.deleteByParentId(id);
        commentRepository.delete(comment);
        adminAuditService.record(adminId, AdminAuditLog.ACTION_COMMENT_DELETE, "COMMENT",
                String.valueOf(id), before, null);
    }

    /** 이미 비공개면 멱등 — 상태 변화가 없으므로 감사 기록도 남기지 않는다(contracts §4). */
    @Transactional
    public void unpublishPlaylist(UUID adminId, Long id) {
        Playlist playlist = playlistRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("플레이리스트를 찾을 수 없습니다."));
        if (!playlist.isPublic()) {
            return;
        }
        playlist.setPublic(false);
        adminAuditService.record(adminId, AdminAuditLog.ACTION_PLAYLIST_UNPUBLISH, "PLAYLIST",
                String.valueOf(id), Map.of("is_public", true), Map.of("is_public", false));
    }
}
