package com.melolist.playlist.domain;

import com.melolist.music.domain.Music;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/**
 * 플레이리스트-곡 조인(PRD §8.2). "담기"는 MUSIC id를 FK로 참조만 한다(부록 A.1 eager 캐시).
 */
@Entity
@Table(name = "playlist_music",
        uniqueConstraints = @UniqueConstraint(columnNames = {"playlist_id", "music_id"}))
@Getter
@Setter
@NoArgsConstructor
public class PlaylistMusic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "playlist_id", nullable = false)
    private Long playlistId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "music_id", nullable = false)
    private Music music;

    @Column(nullable = false)
    private int position;

    @CreationTimestamp
    @Column(name = "added_at", updatable = false)
    private Instant addedAt;

    public PlaylistMusic(Long playlistId, Music music, int position) {
        this.playlistId = playlistId;
        this.music = music;
        this.position = position;
    }
}
