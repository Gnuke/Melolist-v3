package com.melolist.playlist.web;

import com.melolist.auth.CurrentUser;
import com.melolist.playlist.dto.PlaylistDtos.CreateRequest;
import com.melolist.playlist.dto.PlaylistDtos.PlaylistDetailResponse;
import com.melolist.playlist.dto.PlaylistDtos.PlaylistResponse;
import com.melolist.playlist.dto.PlaylistDtos.ReorderRequest;
import com.melolist.playlist.dto.PlaylistDtos.TrackAddRequest;
import com.melolist.playlist.dto.PlaylistDtos.UpdateRequest;
import com.melolist.playlist.service.PlaylistService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ResponseStatus;

import java.util.List;

/**
 * 플레이리스트 API(PRD §7 playlist). 상세 조회만 게스트 허용(공개 플레이리스트),
 * 나머지는 인증 필수 — SecurityConfig 화이트리스트와 짝을 이룬다.
 */
@RestController
@RequestMapping("/api/playlists")
@RequiredArgsConstructor
public class PlaylistController {

    private final PlaylistService playlistService;

    @GetMapping
    public List<PlaylistResponse> myPlaylists(@AuthenticationPrincipal Jwt jwt) {
        return playlistService.getMine(CurrentUser.id(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PlaylistResponse create(@Valid @RequestBody CreateRequest request,
                                   @AuthenticationPrincipal Jwt jwt) {
        return playlistService.create(CurrentUser.id(jwt), request);
    }

    /** 비공개는 소유자만 — 비소유자에게는 404(존재 비노출). */
    @GetMapping("/{id}")
    public PlaylistDetailResponse detail(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        return playlistService.getDetail(id, CurrentUser.idOrNull(jwt));
    }

    @PatchMapping("/{id}")
    public PlaylistResponse update(@PathVariable Long id,
                                   @Valid @RequestBody UpdateRequest request,
                                   @AuthenticationPrincipal Jwt jwt) {
        return playlistService.update(id, CurrentUser.id(jwt), request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @AuthenticationPrincipal Jwt jwt) {
        playlistService.delete(id, CurrentUser.id(jwt));
    }

    @PostMapping("/{id}/tracks")
    @ResponseStatus(HttpStatus.CREATED)
    public void addTrack(@PathVariable Long id,
                         @Valid @RequestBody TrackAddRequest request,
                         @AuthenticationPrincipal Jwt jwt) {
        playlistService.addTrack(id, CurrentUser.id(jwt), request.musicId());
    }

    @DeleteMapping("/{id}/tracks/{musicId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeTrack(@PathVariable Long id,
                            @PathVariable Long musicId,
                            @AuthenticationPrincipal Jwt jwt) {
        playlistService.removeTrack(id, CurrentUser.id(jwt), musicId);
    }

    @PatchMapping("/{id}/tracks/reorder")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorder(@PathVariable Long id,
                        @Valid @RequestBody ReorderRequest request,
                        @AuthenticationPrincipal Jwt jwt) {
        playlistService.reorder(id, CurrentUser.id(jwt), request);
    }
}
