/**
 * music 도메인 — 곡 메타데이터 및 인식결과 캐시(MUSIC).
 *
 * <p>저장(담기) 대상 곡 데이터의 유일한 출처. search 도메인이 ACRCloud 인식 결과를
 * 여기에 upsert(acrid 기준)하고, playlist/community(favorite)는 musicId를 FK로 참조한다.
 * 재생 수단은 {@code youtube_url}. (PRD 부록 A.1)</p>
 *
 * <p>M2 범위.</p>
 */
package com.melolist.music;
