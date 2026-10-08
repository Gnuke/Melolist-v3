package com.melolist.community.web;

import com.melolist.common.dto.PageResponse;
import com.melolist.community.dto.CommunityDtos.CommunityPlaylistResponse;
import com.melolist.community.service.CommunityService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 커뮤니티 탐색 — 공개 플레이리스트 피드(PRD §7 community). 게스트 허용.
 * 공유는 community 소관이지만 데이터는 playlist·user 도메인이 소유하므로
 * CommunityService가 서비스 위임으로 조합한다(spec 005 — 작성자 요약 포함).
 */
@RestController
@RequestMapping("/api/community")
@RequiredArgsConstructor
public class CommunityController {

    private final CommunityService communityService;

    @GetMapping("/playlists")
    public PageResponse<CommunityPlaylistResponse> publicPlaylists(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return communityService.getPublicFeed(PageRequest.of(page, Math.min(size, 50)));
    }
}
