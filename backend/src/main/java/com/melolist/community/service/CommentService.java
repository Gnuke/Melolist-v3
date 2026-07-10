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
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * 공유 플레이리스트 댓글. 플레이리스트 접근 가능 여부(공개/소유)는 playlist 도메인에 위임한다.
 */
@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final PlaylistService playlistService;
    private final UserService userService;

    @Transactional(readOnly = true)
    public List<CommentResponse> getByPlaylist(Long playlistId, UUID viewerId) {
        playlistService.assertViewable(playlistId, viewerId);
        return commentRepository.findByPlaylistIdOrderByCreatedAtAsc(playlistId).stream()
                .map(CommentResponse::from)
                .toList();
    }

    @Transactional
    public CommentResponse create(Jwt jwt, Long playlistId, CreateRequest request) {
        Profile author = userService.getOrProvisionProfile(jwt);
        playlistService.assertViewable(playlistId, author.getId());

        if (request.parentId() != null) {
            Comment parent = commentRepository.findById(request.parentId())
                    .orElseThrow(() -> new IllegalArgumentException("대댓글 대상 댓글이 없습니다."));
            if (!parent.getPlaylistId().equals(playlistId)) {
                throw new IllegalArgumentException("대댓글 대상이 다른 플레이리스트의 댓글입니다.");
            }
            if (parent.getParentId() != null) {
                throw new IllegalArgumentException("대댓글에는 다시 댓글을 달 수 없습니다.");
            }
        }
        return CommentResponse.from(commentRepository.save(
                new Comment(author, playlistId, request.parentId(), request.content())));
    }

    @Transactional
    public void delete(Long id, UUID userId) {
        Comment comment = commentRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("댓글을 찾을 수 없습니다."));
        if (!comment.getAuthor().getId().equals(userId)) {
            throw new ForbiddenException("댓글 작성자만 삭제할 수 있습니다.");
        }
        commentRepository.deleteByParentId(id);
        commentRepository.delete(comment);
    }
}
