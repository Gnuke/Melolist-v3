package com.melolist.search.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * 검색 기록 — 로그인 사용자의 "내 기록"(도메인 데이터). 익명 계측(event_log)과 역할이 다르다.
 * M2에서는 write만 하고, 조회/삭제 API는 M3(backend-prd C4).
 *
 * <p>{@code audio_path}는 오디오 원본 미저장 결정(PRD 부록 A)으로 항상 null.
 * 후속에 임시저장을 도입하면 사용한다.</p>
 */
@Entity
@Table(name = "search_history")
@Getter
@Setter
@NoArgsConstructor
public class SearchHistory {

    /** DEEP = 웹검색 심층 탐색(spec 004) — varchar(20) STRING 매핑이라 값 추가에 DDL 불필요. */
    public enum Type { FINGERPRINT, HUMMING, TEXT, DEEP }

    public enum Status { MATCHED, NO_MATCH }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Type type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(name = "top_music_id")
    private Long topMusicId;

    @Column(precision = 5, scale = 2)
    private BigDecimal score;

    @Column(name = "audio_path")
    private String audioPath;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public SearchHistory(UUID userId, Type type, Status status, Long topMusicId, BigDecimal score) {
        this.userId = userId;
        this.type = type;
        this.status = status;
        this.topMusicId = topMusicId;
        this.score = score;
    }
}
