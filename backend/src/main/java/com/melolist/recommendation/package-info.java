/**
 * recommendation 도메인 — (AI) 자연어 검색·추천·챗의 확장 슬롯.
 *
 * <p>지금은 비워두되, 추천 로직을 {@code RecommendationProvider} 인터페이스 뒤에 두어
 * 룰기반 → AI기반(Spring AI) 교체가 무중단이 되도록 설계한다. Java 21 기준으로
 * 가상 스레드 등 최신 기능을 활용한다. (PRD §11)</p>
 *
 * <p>M5 범위 (Spring AI).</p>
 */
package com.melolist.recommendation;
