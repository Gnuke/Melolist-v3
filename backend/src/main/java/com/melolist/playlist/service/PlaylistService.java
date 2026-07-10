package com.melolist.playlist.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.ConflictException;
import com.melolist.common.error.ForbiddenException;
import com.melolist.common.error.NotFoundException;
import com.melolist.music.domain.Music;
import com.melolist.music.repository.MusicRepository;
import com.melolist.playlist.domain.Playlist;
import com.melolist.playlist.domain.PlaylistMusic;
import com.melolist.playlist.dto.PlaylistDtos.CreateRequest;
import com.melolist.playlist.dto.PlaylistDtos.PlaylistDetailResponse;
import com.melolist.playlist.dto.PlaylistDtos.PlaylistResponse;
import com.melolist.playlist.dto.PlaylistDtos.ReorderRequest;
import com.melolist.playlist.dto.PlaylistDtos.UpdateRequest;
import com.melolist.playlist.repository.PlaylistMusicRepository;
import com.melolist.playlist.repository.PlaylistRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 플레이리스트 CRUD·트랙 관리. 소유권 검증은 앱 계층 단독(부록 A-2) —
 * 비공개 리소스는 404로 감춰 존재를 노출하지 않고, 소유자 아닌 변경 시도는 403.
 */
@Service
@RequiredArgsConstructor
public class PlaylistService {

    private final PlaylistRepository playlistRepository;
    private final PlaylistMusicRepository playlistMusicRepository;
    private final MusicRepository musicRepository;

    @Transactional(readOnly = true)
    public List<PlaylistResponse> getMine(UUID userId) {
        return playlistRepository.findByOwnerIdOrderByUpdatedAtDesc(userId).stream()
                .map(p -> PlaylistResponse.from(p, playlistMusicRepository.countByPlaylistId(p.getId())))
                .toList();
    }

    @Transactional
    public PlaylistResponse create(UUID userId, CreateRequest request) {
        Playlist playlist = playlistRepository.save(new Playlist(
                userId,
                request.title(),
                request.description(),
                Boolean.TRUE.equals(request.isPublic())
        ));
        return PlaylistResponse.from(playlist, 0);
    }

    /** 상세 — 비공개는 소유자만(PRD §7). 비소유자에게는 404. */
    @Transactional(readOnly = true)
    public PlaylistDetailResponse getDetail(Long id, UUID viewerId) {
        Playlist playlist = getViewable(id, viewerId);
        return PlaylistDetailResponse.from(playlist,
                playlistMusicRepository.findByPlaylistIdOrderByPositionAsc(id));
    }

    @Transactional
    public PlaylistResponse update(Long id, UUID userId, UpdateRequest request) {
        Playlist playlist = getOwned(id, userId);
        if (request.title() != null) {
            playlist.setTitle(request.title());
        }
        if (request.description() != null) {
            playlist.setDescription(request.description());
        }
        if (request.isPublic() != null) {
            playlist.setPublic(request.isPublic());
        }
        if (request.coverUrl() != null) {
            playlist.setCoverUrl(request.coverUrl());
        }
        return PlaylistResponse.from(playlist, playlistMusicRepository.countByPlaylistId(id));
    }

    @Transactional
    public void delete(Long id, UUID userId) {
        Playlist playlist = getOwned(id, userId);
        playlistMusicRepository.deleteByPlaylistId(id);
        playlistRepository.delete(playlist);
    }

    /** 곡 추가 — 담기는 MUSIC id FK 참조만(부록 A.1). 이미 담긴 곡은 409. */
    @Transactional
    public void addTrack(Long id, UUID userId, Long musicId) {
        getOwned(id, userId);
        Music music = musicRepository.findById(musicId)
                .orElseThrow(() -> new NotFoundException("곡을 찾을 수 없습니다."));
        if (playlistMusicRepository.existsByPlaylistIdAndMusicId(id, musicId)) {
            throw new ConflictException("이미 플레이리스트에 담긴 곡입니다.");
        }
        int nextPosition = playlistMusicRepository.countByPlaylistId(id);
        playlistMusicRepository.save(new PlaylistMusic(id, music, nextPosition));
    }

    @Transactional
    public void removeTrack(Long id, UUID userId, Long musicId) {
        getOwned(id, userId);
        PlaylistMusic track = playlistMusicRepository.findByPlaylistIdAndMusicId(id, musicId)
                .orElseThrow(() -> new NotFoundException("플레이리스트에 없는 곡입니다."));
        playlistMusicRepository.delete(track);
        compactPositions(id);
    }

    /** 순서 변경 — 전달된 music id 순서대로 position을 다시 매긴다. */
    @Transactional
    public void reorder(Long id, UUID userId, ReorderRequest request) {
        getOwned(id, userId);
        List<PlaylistMusic> tracks = playlistMusicRepository.findByPlaylistIdOrderByPositionAsc(id);
        Map<Long, PlaylistMusic> byMusicId = new HashMap<>();
        tracks.forEach(t -> byMusicId.put(t.getMusic().getId(), t));

        List<Long> orderedIds = request.musicIds();
        if (orderedIds.size() != tracks.size() || !byMusicId.keySet().containsAll(orderedIds)) {
            throw new IllegalArgumentException("music_ids가 플레이리스트의 곡 목록과 일치하지 않습니다.");
        }
        for (int i = 0; i < orderedIds.size(); i++) {
            byMusicId.get(orderedIds.get(i)).setPosition(i);
        }
    }

    /** 커뮤니티 탐색 — 공개 플레이리스트 피드(community 도메인에서 호출). */
    @Transactional(readOnly = true)
    public PageResponse<PlaylistResponse> getPublicPlaylists(Pageable pageable) {
        return PageResponse.of(
                playlistRepository.findByIsPublicTrueOrderByUpdatedAtDesc(pageable),
                p -> PlaylistResponse.from(p, playlistMusicRepository.countByPlaylistId(p.getId()))
        );
    }

    /** 조회 가능 여부 검증 — 댓글 등 다른 도메인에서도 사용한다. */
    @Transactional(readOnly = true)
    public void assertViewable(Long playlistId, UUID viewerId) {
        getViewable(playlistId, viewerId);
    }

    private Playlist getViewable(Long id, UUID viewerId) {
        Playlist playlist = playlistRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("플레이리스트를 찾을 수 없습니다."));
        if (!playlist.isPublic() && !playlist.getOwnerId().equals(viewerId)) {
            throw new NotFoundException("플레이리스트를 찾을 수 없습니다.");
        }
        return playlist;
    }

    private Playlist getOwned(Long id, UUID userId) {
        Playlist playlist = playlistRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("플레이리스트를 찾을 수 없습니다."));
        if (!playlist.getOwnerId().equals(userId)) {
            if (!playlist.isPublic()) {
                throw new NotFoundException("플레이리스트를 찾을 수 없습니다.");
            }
            throw new ForbiddenException("플레이리스트 소유자만 변경할 수 있습니다.");
        }
        return playlist;
    }

    /** 트랙 삭제 후 position 공백을 메워 0..n-1 연속을 유지한다. */
    private void compactPositions(Long playlistId) {
        List<PlaylistMusic> tracks = playlistMusicRepository.findByPlaylistIdOrderByPositionAsc(playlistId);
        for (int i = 0; i < tracks.size(); i++) {
            tracks.get(i).setPosition(i);
        }
    }
}
