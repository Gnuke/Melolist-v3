package com.melolist.community.repository;

import com.melolist.community.domain.Review;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ReviewRepository extends JpaRepository<Review, Long> {

    @EntityGraph(attributePaths = "author")
    Page<Review> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @EntityGraph(attributePaths = "author")
    Optional<Review> findByAuthorId(UUID authorId);

    boolean existsByAuthorId(UUID authorId);
}
