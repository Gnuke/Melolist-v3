package com.melolist.admin.service;

import com.melolist.admin.domain.AdminAuditLog;
import com.melolist.common.error.NotFoundException;
import com.melolist.community.domain.Comment;
import com.melolist.community.domain.Review;
import com.melolist.community.repository.CommentRepository;
import com.melolist.community.repository.ReviewRepository;
import com.melolist.playlist.domain.Playlist;
import com.melolist.playlist.repository.PlaylistRepository;
import com.melolist.user.domain.Profile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** US3 모더레이션 — 삭제 의미론(대댓글 동반)·unpublish 멱등·감사 기록. */
@ExtendWith(MockitoExtension.class)
class AdminModerationServiceTest {

    private static final UUID ADMIN_ID = UUID.randomUUID();

    @Mock
    private ReviewRepository reviewRepository;
    @Mock
    private CommentRepository commentRepository;
    @Mock
    private PlaylistRepository playlistRepository;
    @Mock
    private AdminAuditService adminAuditService;

    @InjectMocks
    private AdminModerationService service;

    private Profile author() {
        Profile profile = mock(Profile.class);
        lenient().when(profile.getId()).thenReturn(UUID.randomUUID());
        return profile;
    }

    @Test
    void 리뷰를_삭제하면_감사가_남는다() {
        Review review = new Review(author(), (short) 1, "부적절한 내용");
        when(reviewRepository.findById(7L)).thenReturn(Optional.of(review));

        service.deleteReview(ADMIN_ID, 7L);

        verify(reviewRepository).delete(review);
        verify(adminAuditService).record(eq(ADMIN_ID), eq(AdminAuditLog.ACTION_REVIEW_DELETE),
                eq("REVIEW"), eq("7"), anyMap(), isNull());
    }

    @Test
    void 댓글_삭제는_대댓글을_동반한다() {
        Comment comment = new Comment(author(), 3L, null, "부적절한 댓글");
        when(commentRepository.findById(11L)).thenReturn(Optional.of(comment));

        service.deleteComment(ADMIN_ID, 11L);

        verify(commentRepository).deleteByParentId(11L);
        verify(commentRepository).delete(comment);
        verify(adminAuditService).record(eq(ADMIN_ID), eq(AdminAuditLog.ACTION_COMMENT_DELETE),
                eq("COMMENT"), eq("11"), anyMap(), isNull());
    }

    @Test
    void 공개_플레이리스트를_비공개로_전환하고_감사가_남는다() {
        Playlist playlist = new Playlist(UUID.randomUUID(), "제목", null, true);
        when(playlistRepository.findById(5L)).thenReturn(Optional.of(playlist));

        service.unpublishPlaylist(ADMIN_ID, 5L);

        assertThat(playlist.isPublic()).isFalse();
        verify(adminAuditService).record(eq(ADMIN_ID), eq(AdminAuditLog.ACTION_PLAYLIST_UNPUBLISH),
                eq("PLAYLIST"), eq("5"), anyMap(), anyMap());
    }

    @Test
    void 이미_비공개면_멱등이고_감사를_남기지_않는다() {
        Playlist playlist = new Playlist(UUID.randomUUID(), "제목", null, false);
        when(playlistRepository.findById(5L)).thenReturn(Optional.of(playlist));

        service.unpublishPlaylist(ADMIN_ID, 5L);
        service.unpublishPlaylist(ADMIN_ID, 5L);

        assertThat(playlist.isPublic()).isFalse();
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any(), any());
        verify(playlistRepository, times(2)).findById(5L);
    }

    @Test
    void 없는_리뷰는_404다() {
        when(reviewRepository.findById(999L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.deleteReview(ADMIN_ID, 999L))
                .isInstanceOf(NotFoundException.class);
        verify(adminAuditService, never()).record(any(), any(), any(), any(), any(), any());
    }
}
