package com.melolist.playlist.repository;

import com.melolist.playlist.domain.PlaylistMusic;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlaylistMusicRepository extends JpaRepository<PlaylistMusic, Long> {

    @EntityGraph(attributePaths = "music")
    List<PlaylistMusic> findByPlaylistIdOrderByPositionAsc(Long playlistId);

    Optional<PlaylistMusic> findByPlaylistIdAndMusicId(Long playlistId, Long musicId);

    boolean existsByPlaylistIdAndMusicId(Long playlistId, Long musicId);

    int countByPlaylistId(Long playlistId);

    void deleteByPlaylistId(Long playlistId);
}
