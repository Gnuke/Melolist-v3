# Data Model: 커뮤니티 — 공개 탐색 피드·서비스 리뷰·댓글

**Date**: 2026-08-12 | **Plan**: [plan.md](./plan.md)

> **신규 테이블·컬럼·마이그레이션 없음.** 세 엔티티 모두 07-10 `create_domain_tables`
> 마이그레이션으로 운영에 이미 존재한다(research.md R1). 이 문서는 스펙 요구와의
> 대조표이며, 변경은 애플리케이션 계층 검증(@Size)뿐이다.

## REVIEW (기존 — `review` 테이블, `community/domain/Review.java`)

| 필드 | 타입 | 제약 | 스펙 대조 |
|---|---|---|---|
| id | bigint | PK | |
| author (user_id) | uuid FK→profiles | **not null, unique** | 1인 1건(FR-004) — unique 제약이 동시 제출 최종 방어(SC-002) |
| rating | smallint | not null, 앱 검증 1~5 | FR-004 별점 필수 |
| content | text | not null, **앱 검증 @Size(max=500) ← 이번에 추가** | FR-009 |
| created_at / updated_at | timestamptz | | 피드 최신순 정렬 키(created_at desc) |

- 곡·플레이리스트와 무관(앱 평가) — 관계 없음.
- 상태 전이: 없음(작성→수정*N→삭제, 삭제 후 재작성 가능 — unique 행 삭제로 자연 충족).

## COMMENT (기존 — `comment` 테이블, `community/domain/Comment.java`)

| 필드 | 타입 | 제약 | 스펙 대조 |
|---|---|---|---|
| id | bigint | PK | |
| author (author_id) | uuid FK→profiles | not null | 본인만 삭제(FR-006) |
| playlist_id | bigint | not null | 공개 여부는 저장 안 함 — 매 요청 `assertViewable`로 판정(엣지: 비공개 전환 시 작성 거부) |
| parent_id | bigint | null | **v1 미사용(예약)** — 프론트는 항상 null 전송, UI 미노출(R3) |
| content | text | not null, **앱 검증 @Size(max=300) ← 이번에 추가** | FR-009 |
| created_at / updated_at | timestamptz | | 목록 오름차순(created_at asc), 비페이지 |

## PROFILES.review_hide_until (기존 컬럼, `user/domain/Profile.java`)

| 필드 | 타입 | 의미 |
|---|---|---|
| review_hide_until | timestamptz null | 리뷰 유도 유예 만료 시각. null 또는 과거 = 유도 가능(FR-010) |

- 쓰기 경로: `PATCH /api/users/me/review-visibility` `{action:"later"}` →
  `now + prompt-defer-days(기본 7일)` — 이번에 신설(R6).
- 읽기 경로: 유도 판정(`GET /api/reviews/prompt`)에서만 사용. `/users/me` 응답에는
  노출하지 않는다(클라이언트가 직접 판정할 일 없음).

## 파생 값 (저장 없음)

| 값 | 원천 | 용도 |
|---|---|---|
| 누적 검색 횟수 | `search_history` `countByUserId(userId)` — 쿼리 메서드 신설 | 유도 판정 "≥3회"(R5). 임계값은 설정 `prompt-search-threshold`(기본 3) |
| 유도 노출 자격 `eligible` | 리뷰 미작성 AND 유예 아님 AND 검색≥3 | `GET /api/reviews/prompt` 응답 — 서버 권위(기기 무관, FR-010) |
| 피드 작성자 요약 | `profiles` 페이지 단위 `findAllById` 일괄 조회 | 공개 피드 `author {id, display_name, avatar_url}` (R4, N+1 방지) |

## 계측 (event_log — 스키마 변경 없음, 사전만 확장)

`event_log(event_type, session_id, user_id, properties, created_at)`에 신규 타입 5종
기록(R7): `community_view`·`review_prompt_shown`·`review_prompt_later`·`review_submit`
·`comment_submit`. 산출 SQL 예시는 [quickstart.md](./quickstart.md) 참조.
