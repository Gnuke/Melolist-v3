/**
 * 관리자 어드민 도메인(spec 003). ADMIN 역할 사용자 전용 {@code /api/admin/**} —
 * 운영 지표 대시보드·MUSIC 캐시 정정·사용자 조회·모더레이션·감사 기록.
 *
 * <p>충돌 회피 원칙(FR-012): 기존 공용 영역(SecurityConfig·GlobalExceptionHandler·기존
 * 리포지토리)을 수정하지 않는다. admin 전용 쿼리는 이 패키지의 리포지토리에만 두고,
 * 기존 리포지토리는 주입해 기존 메서드만 재사용한다.</p>
 */
package com.melolist.admin;
