package com.melolist.admin.config;

import com.melolist.admin.auth.AdminAuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * 어드민 전용 웹 설정 — {@code /api/admin/**} 전 경로에 관리자 인가 인터셉터를 건다.
 * 기존 SecurityConfig·CorsConfig는 수정하지 않는다(spec 003 FR-012, 복수
 * WebMvcConfigurer는 합성된다).
 */
@Configuration
@RequiredArgsConstructor
public class AdminWebConfig implements WebMvcConfigurer {

    private final AdminAuthInterceptor adminAuthInterceptor;

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(adminAuthInterceptor).addPathPatterns("/api/admin/**");
    }
}
