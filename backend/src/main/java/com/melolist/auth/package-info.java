/**
 * auth 도메인 — Supabase JWT 검증/인가 지원.
 *
 * <p>현재 JWT 검증은 {@code common.config.SecurityConfig}(Resource Server, JWKS)에서 처리한다.
 * 커스텀 클레임 매핑(권한/역할 변환), 프로비저닝 훅 등이 필요해지면 이 패키지에 추가한다.</p>
 *
 * <p>M1 범위. 후속: 역할 기반 인가 고도화.</p>
 */
package com.melolist.auth;
