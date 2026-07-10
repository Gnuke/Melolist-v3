package com.melolist.recommendation.service;

import java.util.List;
import java.util.UUID;

/**
 * 추천 공급자 확장 슬롯(PRD §11). 룰기반 → AI기반(Spring AI, M5) 교체가 무중단이 되도록
 * 도메인 서비스는 이 인터페이스에만 의존한다. M5 전까지 구현체 없음 — 엔드포인트도 미개방.
 */
public interface RecommendationProvider {

    /** 개인화 곡 추천 — MUSIC id 목록. */
    List<Long> recommendMusic(UUID userId, int limit);

    /** 플레이리스트 추천 — PLAYLIST id 목록. */
    List<Long> recommendPlaylists(UUID userId, int limit);
}
