package com.melolist.auth;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/**
 * Supabase JWT에서 현재 사용자 식별자를 꺼내는 헬퍼.
 * {@code sub} 클레임 = Supabase 사용자 UUID = profiles PK.
 */
public final class CurrentUser {

    private CurrentUser() {
    }

    /** 게스트 허용 엔드포인트용 — JWT가 없으면 null. */
    public static UUID idOrNull(Jwt jwt) {
        return jwt == null ? null : UUID.fromString(jwt.getSubject());
    }

    /** 인증 필수 엔드포인트용 — SecurityFilterChain이 선차단하므로 null이면 설정 오류다. */
    public static UUID id(Jwt jwt) {
        if (jwt == null) {
            throw new IllegalStateException("인증 필수 엔드포인트에 JWT가 없습니다. SecurityConfig를 확인하세요.");
        }
        return UUID.fromString(jwt.getSubject());
    }
}
