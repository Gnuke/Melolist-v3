package com.melolist.community.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 리뷰 유도 정책(spec 005 FR-010) — 수치는 운영에서 조정 가능한 설정값(clarify 확정).
 */
@ConfigurationProperties(prefix = "melolist.review")
public record ReviewProperties(
        /* "나중에" 선택 시 유예 일수 — 서버 저장이라 기기 무관 */
        @DefaultValue("7") int promptDeferDays,
        /* 유도 노출 임계 누적 검색 횟수(search_history 기준) */
        @DefaultValue("3") int promptSearchThreshold
) {
}
