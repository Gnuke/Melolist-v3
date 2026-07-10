package com.melolist.community.web;

import com.melolist.auth.CurrentUser;
import com.melolist.community.dto.CommentDtos.CommentResponse;
import com.melolist.community.dto.CommentDtos.CreateRequest;
import com.melolist.community.service.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 공유 플레이리스트 댓글 API(PRD §7 community).
 * 목록은 게스트 허용(공개 플레이리스트), 작성/삭제는 인증 필수.
 */
@RestController
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping("/api/playlists/{playlistId}/comments")
    public List<CommentResponse> list(@PathVariable Long playlistId, @AuthenticationPrincipal Jwt jwt) {
        return commentService.getByPlaylist(playlistId, CurrentUser.idOrNull(jwt));
    }

    @PostMapping("/api/playlists/{playlistId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse create(@PathVariable Long playlistId,
                                  @Valid @RequestBody CreateRequest request,
                                  @AuthenticationPrincipal Jwt jwt) {
        return commentService.create(jwt, playlistId, request);
    }

    @DeleteMapping("/api/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        commentService.delete(id, CurrentUser.id(jwt));
    }
}
