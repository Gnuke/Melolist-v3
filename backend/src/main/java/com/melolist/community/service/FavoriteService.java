package com.melolist.community.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.NotFoundException;
import com.melolist.community.domain.Favorite;
import com.melolist.community.dto.FavoriteDtos.FavoriteResponse;
import com.melolist.community.repository.FavoriteRepository;
import com.melolist.music.domain.Music;
import com.melolist.music.dto.MusicResponse;
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
 * 이미 있으면 추가는 기존 행을 반환, 없으면 삭제도 조용히 성공.
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

    /**
     * musicId 또는 acrid로 담는다(검색 결과 화면은 acrid만 가진다 — M3 계약).
     * 저장 결과를 반환해 클라이언트가 토글 해제(musicId 기준 DELETE)에 쓸 수 있게 한다.
     *
     * <p>의도적으로 트랜잭션을 걸지 않는다: unique(user_id, music_id) 충돌 후 같은
     * 트랜잭션에서 재조회하면 PG가 aborted tx로 거부하므로, 조회·저장을 각자의
     * 트랜잭션으로 두고 충돌 시 새 조회로 기존 행을 반환한다(멱등).</p>
     */
    public FavoriteResponse add(Jwt jwt, Long musicId, String acrid) {
        UUID userId = userService.getOrProvisionProfile(jwt).getId();
        Music music = resolveMusic(musicId, acrid);
        return favoriteRepository.findByUserIdAndMusicId(userId, music.getId())
                .map(f -> toResponse(f, music))
                .orElseGet(() -> insert(userId, music));
    }

    private FavoriteResponse insert(UUID userId, Music music) {
        try {
            return toResponse(favoriteRepository.save(new Favorite(userId, music)), music);
        } catch (DataIntegrityViolationException e) {
            // 동시 요청이 unique(user_id, music_id)에 먼저 도달 — 멱등이므로 기존 행 반환
            return favoriteRepository.findByUserIdAndMusicId(userId, music.getId())
                    .map(f -> toResponse(f, music))
                    .orElseThrow(() -> e);
        }
    }

    private Music resolveMusic(Long musicId, String acrid) {
        if (musicId != null) {
            return musicRepository.findById(musicId)
                    .orElseThrow(() -> new NotFoundException("곡을 찾을 수 없습니다."));
        }
        if (acrid != null && !acrid.isBlank()) {
            // 검색 직후에는 비동기 upsert가 아직일 수 있다 — 404를 받은 클라이언트가 재시도한다
            return musicRepository.findByAcrid(acrid)
                    .orElseThrow(() -> new NotFoundException("곡을 찾을 수 없습니다."));
        }
        throw new IllegalArgumentException("music_id 또는 acrid가 필요합니다.");
    }

    /** 세션 밖에서도 안전하게 — Favorite.music(LAZY) 대신 이미 조회한 Music으로 응답을 만든다. */
    private FavoriteResponse toResponse(Favorite f, Music music) {
        return new FavoriteResponse(f.getId(), MusicResponse.from(music), f.getCreatedAt());
    }

    @Transactional
    public void remove(UUID userId, Long musicId) {
        favoriteRepository.findByUserIdAndMusicId(userId, musicId)
                .ifPresent(favoriteRepository::delete);
    }
}
