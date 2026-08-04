package com.melolist.common.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Supabase JWT 기반 Resource Server 보안 설정.
 *
 * <p>프론트가 Supabase JS SDK로 로그인 → JWT 발급. 백엔드는 이 JWT를
 * {@code jwk-set-uri}(Supabase JWKS)로 검증만 한다. 세션은 stateless.</p>
 *
 * <p>비회원 허용 엔드포인트(검색/조회)는 여기서 명시적으로 permitAll,
 * 그 외는 인증 필요. 리소스 소유권 검증은 각 도메인 서비스 계층에서 처리한다.</p>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // 헬스체크(Docker/CI)
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        // 심층 탐색(spec 004)은 로그인 전용 — 회당 비용이 커 게스트 제외.
                        // 검색 경로에 permitAll 와일드카드가 생겨도 삼켜지지 않게 먼저 선언(spec 001 교훈)
                        .requestMatchers("/api/search/deep/**").authenticated()
                        .requestMatchers(HttpMethod.POST, "/api/search/deep").authenticated()
                        // 게스트 허용: 음악 검색 (text/select = AI 폴백 후보 선택 확정, spec 002)
                        .requestMatchers(HttpMethod.POST, "/api/search/fingerprint", "/api/search/humming",
                                "/api/search/text", "/api/search/text/select").permitAll()
                        // 게스트 허용: 이벤트 수집(익명 계측, backend-prd §9-6)
                        .requestMatchers(HttpMethod.POST, "/api/events").permitAll()
                        // 게스트 허용: 곡/리뷰/공개 플레이리스트 조회
                        .requestMatchers(HttpMethod.GET, "/api/music/**").permitAll()
                        // 내 리뷰는 인증 필수 — 아래 /api/reviews/* 와일드카드보다 먼저 선언
                        .requestMatchers(HttpMethod.GET, "/api/reviews/me").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/reviews", "/api/reviews/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/community/**").permitAll()
                        // 게스트 허용: 플레이리스트 상세·댓글 조회 — 비공개 접근 제어는 서비스 계층(404)
                        .requestMatchers(HttpMethod.GET, "/api/playlists/*", "/api/playlists/*/comments").permitAll()
                        // 내 프로필은 인증 필수 — 아래 공개 프로필 와일드카드(/api/users/*)에 삼켜지지 않게 먼저 선언
                        .requestMatchers("/api/users/me", "/api/users/me/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/users/*").permitAll()
                        // 그 외 전부 인증 필요
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
