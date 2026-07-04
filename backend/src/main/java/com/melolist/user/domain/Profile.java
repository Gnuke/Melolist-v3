package com.melolist.user.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
 * 사용자 프로필. Supabase {@code auth.users}를 미러링한다.
 * PK는 Supabase 사용자 UUID를 그대로 사용(= JWT의 sub 클레임).
 * 최초 접근 시 JIT(Just-In-Time)로 프로비저닝된다.
 */
@Entity
@Table(name = "profiles")
@Getter
@Setter
@NoArgsConstructor
public class Profile {

    @Id
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(nullable = false)
    private String role = "USER";

    /** "나중에" 선택 시 리뷰 유도 모달을 숨길 시각. (PRD 리뷰 유도 UX) */
    @Column(name = "review_hide_until")
    private Instant reviewHideUntil;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public Profile(UUID id, String email, String displayName) {
        this.id = id;
        this.email = email;
        this.displayName = displayName;
        this.role = "USER";
    }
}
