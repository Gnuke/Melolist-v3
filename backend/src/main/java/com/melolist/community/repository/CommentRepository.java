package com.melolist.community.repository;

import com.melolist.community.domain.Comment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    @EntityGraph(attributePaths = "author")
    List<Comment> findByPlaylistIdOrderByCreatedAtAsc(Long playlistId);

    void deleteByParentId(Long parentId);
}
