package com.melolist.search.repository;

import com.melolist.search.domain.SearchHistory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SearchHistoryRepository extends JpaRepository<SearchHistory, Long> {

    Page<SearchHistory> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Optional<SearchHistory> findByIdAndUserId(Long id, UUID userId);

    /** 누적 검색 횟수 — 리뷰 유도 임계 판정(spec 005 R5, 서버 권위·기기 무관). */
    long countByUserId(UUID userId);
}
