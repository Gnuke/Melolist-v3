package com.melolist.playlist.repository;

import com.melolist.playlist.domain.Playlist;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PlaylistRepository extends JpaRepository<Playlist, Long> {

    List<Playlist> findByOwnerIdOrderByUpdatedAtDesc(UUID ownerId);

    /** 커뮤니티 탐색 피드 — 공개 플레이리스트만(PRD §7 community). */
    Page<Playlist> findByIsPublicTrueOrderByUpdatedAtDesc(Pageable pageable);
}
