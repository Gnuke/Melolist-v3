/**
 * search 도메인 — 지문/허밍/텍스트 검색, ACRCloud 연동, 검색기록(SEARCH_HISTORY).
 *
 * <p>핵심 신규 서버 책임: 인식 결과를 music 도메인의 MUSIC 캐시에 upsert하고 유튜브 링크를
 * 보강한다(v2는 pass-through라 저장 안 함). 게스트 검색 허용. (PRD 부록 A.1)</p>
 *
 * <p>M2 범위.</p>
 */
package com.melolist.search;
