package com.melolist.community.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.NotFoundException;
import com.melolist.community.domain.Favorite;
import com.melolist.community.dto.FavoriteDtos.FavoriteResponse;
import com.melolist.community.repository.FavoriteRepository;
import com.melolist.music.domain.Music;
import com.melolist.music.repository.MusicRepository;
import com.melolist.user.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 곡 즐겨찾기. 토글 UX(스와이프 추가/삭제)를 고려해 추가/삭제 모두 멱등으로 처리한다 —
 * 이미 있으면 추가는 조용히 성공, 없으면 삭제도 조용히 성공.
 */
@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final MusicRepository musicRepository;
    private final UserService userService;

    @Transactional(readOnly = true)
    public PageResponse<FavoriteResponse> getPage(UUID userId, Pageable pageable) {
        return PageResponse.of(
                favoriteRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable),
                FavoriteResponse::from
        );
    }

    @Transactional
    public void add(Jwt jwt, Long musicId) {
        UUID userId = userService.getOrProvisionProfile(jwt).getId();
        Music music = musicRepository.findById(musicId)
                .orElseThrow(() -> new NotFoundException("곡을 찾을 수 없습니다."));
        if (favoriteRepository.existsByUserIdAndMusicId(userId, musicId)) {
            return;
        }
        try {
            favoriteRepository.save(new Favorite(userId, music));
        } catch (DataIntegrityViolationException e) {
            // 동시 요청이 unique(user_id, music_id)에 먼저 도달 — 멱등이므로 무시
        }
    }

    @Transactional
    public void remove(UUID userId, Long musicId) {
        favoriteRepository.findByUserIdAndMusicId(userId, musicId)
                .ifPresent(favoriteRepository::delete);
    }
}
