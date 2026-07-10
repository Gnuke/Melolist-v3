/**
 * event 패키지 — 익명 이벤트 계측(event_log). 특정 도메인 소유가 아니어서 최상위에 둔다
 * (backend-prd §4).
 *
 * <p>SearchHistory(로그인 사용자의 "내 기록", 도메인 데이터)와 event_log(익명 계측)는
 * 역할이 달라 분리 유지한다(backend-prd §7.2). KR2·KR3 산출의 원천.</p>
 *
 * <p>M2 범위.</p>
 */
package com.melolist.event;
