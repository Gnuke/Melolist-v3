package com.melolist.community.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.community.dto.AuthorSummary;
import com.melolist.community.dto.CommunityDtos.CommunityPlaylistResponse;
import com.melolist.playlist.dto.PlaylistDtos.PlaylistResponse;
import com.melolist.playlist.service.PlaylistService;
import com.melolist.user.domain.Profile;
import com.melolist.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * 커뮤니티 탐색 피드. 데이터는 playlist·user 도메인이 소유하므로 서비스 위임으로만
 * 조합하고, 작성자 프로필은 페이지 단위 일괄 조회로 붙인다(N+1 방지 — 기록 화면 패턴).
 */
@Service
@RequiredArgsConstructor
public class CommunityService {

    private final PlaylistService playlistService;
    private final UserService userService;

    @Transactional(readOnly = true)
    public PageResponse<CommunityPlaylistResponse> getPublicFeed(Pageable pageable) {
        PageResponse<PlaylistResponse> page = playlistService.getPublicPlaylists(pageable);
        Set<UUID> ownerIds = page.items().stream()
                .map(PlaylistResponse::ownerId)
                .collect(Collectors.toSet());
        Map<UUID, Profile> owners = userService.getProfileMap(ownerIds);
        List<CommunityPlaylistResponse> items = page.items().stream()
                .map(p -> CommunityPlaylistResponse.from(p, toAuthor(owners.get(p.ownerId()))))
                .toList();
        return new PageResponse<>(items, page.page(), page.size(), page.totalItems(), page.totalPages());
    }

    /** 탈퇴 등으로 프로필이 없으면 author=null — 피드가 깨지는 것보다 낫다. */
    private AuthorSummary toAuthor(Profile profile) {
        return profile == null ? null : AuthorSummary.from(profile);
    }
}
