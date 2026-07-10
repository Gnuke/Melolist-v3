package com.melolist.community.web;

import com.melolist.common.dto.PageResponse;
import com.melolist.playlist.dto.PlaylistDtos.PlaylistResponse;
import com.melolist.playlist.service.PlaylistService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 커뮤니티 탐색 — 공개 플레이리스트 피드(PRD §7 community). 게스트 허용.
 * 공유는 community 소관이지만 데이터는 playlist 도메인이 소유하므로 서비스에 위임한다.
 */
@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

    private final PlaylistService playlistService;

    @GetMapping("/playlists")
    public PageResponse<PlaylistResponse> publicPlaylists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return playlistService.getPublicPlaylists(PageRequest.of(page, Math.min(size, 50)));
    }
}
