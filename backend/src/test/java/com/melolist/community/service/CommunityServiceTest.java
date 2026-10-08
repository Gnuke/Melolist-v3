package com.melolist.community.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.community.dto.CommunityDtos.CommunityPlaylistResponse;
import com.melolist.playlist.dto.PlaylistDtos.PlaylistResponse;
import com.melolist.playlist.service.PlaylistService;
import com.melolist.user.domain.Profile;
import com.melolist.user.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/** 커뮤니티 공개 피드 — 작성자 요약 일괄 매핑(spec 005 R4, N+1 방지). */
@ExtendWith(MockitoExtension.class)
class CommunityServiceTest {

    private static final UUID OWNER_ID = UUID.randomUUID();
    private static final Pageable PAGE = PageRequest.of(0, 20);

    @Mock
    private PlaylistService playlistService;
    @Mock
    private UserService userService;

    @InjectMocks
    private CommunityService communityService;

    private PlaylistResponse playlist(Long id, UUID ownerId) {
        return new PlaylistResponse(id, ownerId, "출근길 발견", null, true, "https://cover", 12,
                Instant.now(), Instant.now());
    }

    @Test
    void 공개_피드에_작성자_요약을_붙인다() {
        Profile owner = new Profile(OWNER_ID, "owner@melolist.app", "멜로");
        owner.setAvatarUrl("https://avatar");
        when(playlistService.getPublicPlaylists(PAGE))
                .thenReturn(new PageResponse<>(List.of(playlist(1L, OWNER_ID)), 0, 20, 1, 1));
        when(userService.getProfileMap(any())).thenReturn(Map.of(OWNER_ID, owner));

        PageResponse<CommunityPlaylistResponse> feed = communityService.getPublicFeed(PAGE);

        CommunityPlaylistResponse item = feed.items().getFirst();
        assertThat(item.title()).isEqualTo("출근길 발견");
        assertThat(item.trackCount()).isEqualTo(12);
        assertThat(item.author().displayName()).isEqualTo("멜로");
        assertThat(item.author().avatarUrl()).isEqualTo("https://avatar");
    }

    @Test
    void 작성자_프로필이_없어도_피드는_깨지지_않는다() {
        when(playlistService.getPublicPlaylists(PAGE))
                .thenReturn(new PageResponse<>(List.of(playlist(1L, OWNER_ID)), 0, 20, 1, 1));
        when(userService.getProfileMap(any())).thenReturn(Map.of());

        PageResponse<CommunityPlaylistResponse> feed = communityService.getPublicFeed(PAGE);

        assertThat(feed.items().getFirst().author()).isNull();
    }

    @Test
    void 페이지_메타데이터를_그대로_보존한다() {
        when(playlistService.getPublicPlaylists(PAGE))
                .thenReturn(new PageResponse<>(List.of(playlist(1L, OWNER_ID), playlist(2L, OWNER_ID)), 1, 20, 42, 3));
        when(userService.getProfileMap(any())).thenReturn(Map.of());

        PageResponse<CommunityPlaylistResponse> feed = communityService.getPublicFeed(PAGE);

        assertThat(feed.items()).hasSize(2);
        assertThat(feed.page()).isEqualTo(1);
        assertThat(feed.totalItems()).isEqualTo(42);
        assertThat(feed.totalPages()).isEqualTo(3);
    }
}
