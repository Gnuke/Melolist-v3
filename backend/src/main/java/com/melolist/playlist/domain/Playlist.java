package com.melolist.playlist.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * 플레이리스트(PRD §8.2). 공개(is_public) 전환 시 커뮤니티 탐색에 노출된다.
 * 소유권 검증은 앱 계층 단독(부록 A-2).
 */
@Entity
@Table(name = "playlist")
@Getter
@Setter
@NoArgsConstructor
public class Playlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 120)
    private String title;

    private String description;

    @Column(name = "is_public", nullable = false)
    private boolean isPublic = false;

    @Column(name = "cover_url")
    private String coverUrl;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public Playlist(UUID ownerId, String title, String description, boolean isPublic) {
        this.ownerId = ownerId;
        this.title = title;
        this.description = description;
        this.isPublic = isPublic;
    }
}
