package com.melolist.event.domain;

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
 * 익명 이벤트 로그(backend-prd §7.2). 게스트 PII 없음 — session_id(UUID)만 받고
 * IP는 저장하지 않는다(§9). user_id는 JWT가 있을 때만 서버가 채운다.
 */
@Entity
@Table(name = "event_log")
@Getter
@NoArgsConstructor
public class EventLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "user_id")
    private UUID userId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private Map<String, Object> properties;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    public EventLog(String eventType, UUID sessionId, UUID userId, Map<String, Object> properties) {
        this.eventType = eventType;
        this.sessionId = sessionId;
        this.userId = userId;
        this.properties = properties == null ? Map.of() : properties;
    }
}
