package com.melolist.music.domain;

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
import java.time.LocalDate;

/**
 * 곡 메타데이터 캐시(eager 캐시). 저장(담기) 대상 곡 데이터의 유일한 출처다(PRD 부록 A.1).
 * 검색 시 ACRCloud 인식 결과를 acrid 기준으로 upsert하며, 즐겨찾기/플레이리스트는 이 id를 FK로 참조만 한다.
 *
 * <p>backend-prd C1 개정: {@code youtube_video_id}가 재생 정본이고 {@code youtube_url}은
 * DTO에서 파생한다. {@code thumbnail_url} 폐기 → {@code cover_url}(핫링크 URL 문자열만 저장,
 * 이미지 재호스팅 금지 §9). {@code preview_url}은 저장하지 않는다.</p>
 */
@Entity
@Table(name = "music")
@Getter
@Setter
@NoArgsConstructor
public class Music {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ACRCloud 곡 식별자 — upsert 키. */
    @Column(length = 64, unique = true)
    private String acrid;

    @Column(nullable = false)
    private String title;

    /** 복수 아티스트는 ", "로 연결해 저장. */
    private String artist;

    private String album;

    @Column(name = "release_date")
    private LocalDate releaseDate;

    /** 재생 정본. 파생 URL = https://www.youtube.com/watch?v={id} */
    @Column(name = "youtube_video_id", length = 20)
    private String youtubeVideoId;

    /** 커버 핫링크 URL. album.covers.medium → ytimg 폴백 → null (§5.2) */
    @Column(name = "cover_url")
    private String coverUrl;

    @Column(name = "duration_ms")
    private Integer durationMs;

    @Column(nullable = false, length = 20)
    private String source = "ACRCLOUD";

    /** 관리자 수동 정정 표시 — true면 자동 보강(fillMissing)이 이 곡을 덮어쓰지 않는다(spec 003 FR-007). */
    @Column(name = "meta_locked", nullable = false)
    private boolean metaLocked = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
