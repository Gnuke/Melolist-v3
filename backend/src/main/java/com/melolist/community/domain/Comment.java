package com.melolist.community.domain;

import com.melolist.user.domain.Profile;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * 공유(공개) 플레이리스트 댓글(PRD §8.2). parent_id로 1단 대댓글을 지원한다.
 * v2의 v-html XSS를 반복하지 않도록 렌더는 텍스트만(프론트 규칙), 서버는 원문 저장.
 */
@Entity
@Table(name = "comment")
@Getter
@Setter
@NoArgsConstructor
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false)
    private Profile author;

    @Column(name = "playlist_id", nullable = false)
    private Long playlistId;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(nullable = false)
    private String content;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public Comment(Profile author, Long playlistId, Long parentId, String content) {
        this.author = author;
        this.playlistId = playlistId;
        this.parentId = parentId;
        this.content = content;
    }
}
