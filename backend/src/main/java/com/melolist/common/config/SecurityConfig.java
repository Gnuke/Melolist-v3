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
                        // 게스트 허용: 음악 검색
                        .requestMatchers(HttpMethod.POST, "/api/search/fingerprint", "/api/search/humming", "/api/search/text").permitAll()
                        // 게스트 허용: 곡/리뷰/공개 플레이리스트 조회
                        .requestMatchers(HttpMethod.GET, "/api/music/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/reviews", "/api/reviews/*").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/community/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/users/*").permitAll()
                        // 그 외 전부 인증 필요
                        .anyRequest().authenticated()
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));
        return http.build();
    }
}
