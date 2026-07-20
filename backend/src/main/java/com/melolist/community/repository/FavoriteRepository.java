package com.melolist.community.repository;

import com.melolist.community.domain.Favorite;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FavoriteRepository extends JpaRepository<Favorite, Long> {

    @EntityGraph(attributePaths = "music")
    Page<Favorite> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Optional<Favorite> findByUserIdAndMusicId(UUID userId, Long musicId);

    List<Favorite> findByUserIdAndMusicIdIn(UUID userId, Collection<Long> musicIds);
}
