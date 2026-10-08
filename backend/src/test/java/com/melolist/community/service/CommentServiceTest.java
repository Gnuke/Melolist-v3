package com.melolist.community.service;

import com.melolist.common.error.ForbiddenException;
import com.melolist.common.error.NotFoundException;
import com.melolist.community.domain.Comment;
import com.melolist.community.dto.CommentDtos.CommentResponse;
import com.melolist.community.dto.CommentDtos.CreateRequest;
import com.melolist.community.repository.CommentRepository;
import com.melolist.playlist.service.PlaylistService;
import com.melolist.user.domain.Profile;
import com.melolist.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 공개 플레이리스트 댓글(spec 005 US3 — R1 갭 백필). 공개 검증은 playlist 도메인
 * 위임, 삭제는 작성자 한정, 대댓글 규칙(1단·같은 플레이리스트)은 기존 동작 고정.
 */
@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

    private static final Long PLAYLIST_ID = 3L;
    private static final Long COMMENT_ID = 21L;
    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID OTHER_ID = UUID.randomUUID();

    @Mock
    private CommentRepository commentRepository;
    @Mock
    private PlaylistService playlistService;
    @Mock
    private UserService userService;

    @InjectMocks
    private CommentService commentService;

    private final Jwt jwt = mock(Jwt.class);
    private Profile author;

    @BeforeEach
    void setUp() {
        author = mock(Profile.class);
        lenient().when(author.getId()).thenReturn(USER_ID);
        lenient().when(userService.getOrProvisionProfile(jwt)).thenReturn(author);
    }

    @Test
    void 작성_전에_플레이리스트_공개_여부를_검증한다() {
        when(commentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CommentResponse response = commentService.create(jwt, PLAYLIST_ID, new CreateRequest("좋아요", null));

        verify(playlistService).assertViewable(PLAYLIST_ID, USER_ID);
        assertThat(response.content()).isEqualTo("좋아요");
        assertThat(response.playlistId()).isEqualTo(PLAYLIST_ID);
    }

    @Test
    void 비공개_전환된_플레이리스트에는_작성이_거부된다() {
        doThrow(new NotFoundException("플레이리스트를 찾을 수 없습니다."))
                .when(playlistService).assertViewable(PLAYLIST_ID, USER_ID);

        assertThatThrownBy(() -> commentService.create(jwt, PLAYLIST_ID, new CreateRequest("좋아요", null)))
                .isInstanceOf(NotFoundException.class);
        verify(commentRepository, never()).save(any());
    }

    @Test
    void 다른_플레이리스트의_댓글을_부모로_지정하면_거부된다() {
        Comment parent = new Comment(author, 999L, null, "다른 곳의 댓글");
        when(commentRepository.findById(1L)).thenReturn(Optional.of(parent));

        assertThatThrownBy(() -> commentService.create(jwt, PLAYLIST_ID, new CreateRequest("답글", 1L)))
                .isInstanceOf(IllegalArgumentException.class);
        verify(commentRepository, never()).save(any());
    }

    @Test
    void 대댓글에는_다시_댓글을_달_수_없다() {
        Comment reply = new Comment(author, PLAYLIST_ID, 5L, "이미 대댓글");
        when(commentRepository.findById(1L)).thenReturn(Optional.of(reply));

        assertThatThrownBy(() -> commentService.create(jwt, PLAYLIST_ID, new CreateRequest("2단 시도", 1L)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 작성자가_아니면_삭제는_403이다() {
        when(commentRepository.findById(COMMENT_ID))
                .thenReturn(Optional.of(new Comment(author, PLAYLIST_ID, null, "내 댓글")));

        assertThatThrownBy(() -> commentService.delete(COMMENT_ID, OTHER_ID))
                .isInstanceOf(ForbiddenException.class);
        verify(commentRepository, never()).delete(any());
    }

    @Test
    void 삭제하면_대댓글도_함께_지운다() {
        Comment comment = new Comment(author, PLAYLIST_ID, null, "내 댓글");
        when(commentRepository.findById(COMMENT_ID)).thenReturn(Optional.of(comment));

        commentService.delete(COMMENT_ID, USER_ID);

        verify(commentRepository).deleteByParentId(COMMENT_ID);
        verify(commentRepository).delete(comment);
    }
}
