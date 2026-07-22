package com.melolist.admin.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * 관리자 변경 작업 감사 기록(spec 003 FR-011, data-model §1).
 * 변경 작업과 <b>동일 트랜잭션</b>에서 기록되어 누락이 구조적으로 불가능하다(SC-004).
 * admin_id는 FK를 걸지 않는다 — 감사 행은 프로필 삭제와 무관하게 보존한다.
 */
@Entity
@Table(name = "admin_audit_log")
@Getter
@NoArgsConstructor
public class AdminAuditLog {

    public static final String ACTION_MUSIC_UPDATE = "MUSIC_UPDATE";
    public static final String ACTION_MUSIC_DELETE = "MUSIC_DELETE";
    public static final String ACTION_REVIEW_DELETE = "REVIEW_DELETE";
    public static final String ACTION_COMMENT_DELETE = "COMMENT_DELETE";
    public static final String ACTION_PLAYLIST_UNPUBLISH = "PLAYLIST_UNPUBLISH";
    public static final String ACTION_ROLE_CHANGE = "ROLE_CHANGE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_id", nullable = false)
    private UUID adminId;

    @Column(nullable = false)
    private String action;

    @Column(name = "target_type", nullable = false)
    private String targetType;

    /** 대상 PK 문자열화 — 타입 혼재(bigint/uuid) 대응. */
    @Column(name = "target_id", nullable = false)
    private String targetId;

    /** 변경 전/후 스냅샷 {@code {"before": {...}, "after": {...}}} — 삭제는 before만. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> detail;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public AdminAuditLog(UUID adminId, String action, String targetType, String targetId,
                         Map<String, Object> detail) {
        this.adminId = adminId;
        this.action = action;
        this.targetType = targetType;
        this.targetId = targetId;
        this.detail = detail == null ? Map.of() : detail;
    }
}
