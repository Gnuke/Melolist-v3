# Quickstart 검증 가이드: 커뮤니티 — 공개 탐색 피드·서비스 리뷰·댓글

**Date**: 2026-08-12 | **계약**: [contracts/community-api.md](./contracts/community-api.md)

외부 API 의존이 없어 mock 프로파일 없이 로컬 실기동으로 전 구간 검증 가능하다.
검색(유도 트리거)만 acr-mock 프로파일로 돌리면 실호출 없이 재현된다.

## 사전 준비

```powershell
# 백엔드 — 빌드+테스트 (135건+신규 GREEN 확인)
cd backend; .\gradlew.bat build

# 프론트 — 타입체크+빌드+vitest (40건+신규 GREEN 확인)
cd frontend; npm run build; npx vitest run

# 로컬 기동 (backend/.env 값 필요 — 워크트리가 아니므로 원본 그대로)
cd backend; .\gradlew.bat bootRun --args='--spring.profiles.active=acr-mock'
cd frontend; npm run dev
```

> 운영 이벤트 오염 방지: 검증은 로컬 백엔드+로컬 프론트로 수행한다. 운영 스모크는
> PR 병합·Render 배포 후 최소 항목만.

## 시나리오 검증 (스펙 US·SC 대응)

| # | 시나리오 | 절차 | 기대 결과 |
|---|---|---|---|
| 1 | 게스트 피드 조회 (US1, SC-001·SC-006) | 로그아웃 상태 → 하단 내비 "커뮤니티" 탭 | 5탭 표시, 공개 플레이리스트 피드(작성자 닉네임 포함) 로드, 로그인 요구 없음, **웜 상태 기준 첫 피드 3초 이내 표시** |
| 2 | 세그먼트 전환 (FR-001) | 커뮤니티 화면에서 "리뷰" 세그먼트 탭 | 리뷰 피드 전환, 각 세그먼트 독립 "더 보기" 페이징 |
| 3 | 빈 상태 (US1-3) | 리뷰 0건 상태에서 리뷰 세그먼트 | 빈 상태 안내, 화면 깨짐 없음 |
| 4 | 피드→상세 (US1-2) | 피드 항목 탭 | 기존 공개 상세로 이동, 곡 조회 가능 |
| 5 | 리뷰 작성 (US2-1) | 로그인 → 리뷰 세그먼트 "리뷰 쓰기" → 별점+내용 제출 | 201, 피드 최상단 노출, `review_submit` 이벤트 |
| 6 | 1인 1리뷰 409 (US2-2, SC-002) | 같은 계정으로 재작성 시도(다른 탭에서 POST 재현 가능) | 409 + "이미 작성" 안내 + 수정 시트 전환 |
| 7 | 수정·삭제 (US2-3) | 내 리뷰 수정 → 피드 반영 → 삭제 → 재작성 | 전부 성공, 삭제 후 작성 가능 |
| 8 | XSS (SC-003) | 리뷰·댓글에 `<script>alert(1)</script><b>굵게</b>` 입력 | 실행·굵게 렌더 없이 원문 그대로 표시 |
| 9 | 길이 상한 (FR-009) | 리뷰 501자/댓글 301자 — 입력창은 maxLength 차단, curl로 직접 POST | 400 표준 바디, 화면은 정제 카피 |
| 10 | 게스트 작성 유도 (US2-4, US3-2) | 게스트로 리뷰 쓰기/댓글 입력 시도 | GuestPrompt·인라인 CTA → 로그인 → 원래 맥락 복귀 |
| 11 | 댓글 (US3) | 공개 플레이리스트 상세에서 작성→게스트 조회→본인 삭제 | 목록 반영, 타인 댓글에 삭제 버튼 없음, `comment_submit` 이벤트 |
| 12 | 비공개 전환 엣지 (US3-4) | 소유 계정으로 비공개 전환 → 다른 계정으로 댓글 POST | 404 + 안내 카피 |
| 13 | 리뷰 유도 (US4, SC-005) | 신규 계정으로 acr-mock 검색 3회 → 결과 화면 | 유도 시트 1회 노출(`review_prompt_shown`) |
| 14 | "나중에" 유예 (US4-2) | 유도에서 "나중에" → 재검색·재로그인(가능하면 타 브라우저) | 유예 기간 내 재노출 0건 — 서버 저장 확인은 아래 SQL |
| 15 | 기작성자 미노출 (US4-4) | 리뷰 있는 계정으로 검색 반복 | 유도 미노출 |

## 데이터 확인 SQL (Supabase — SC-004·SC-005 산출 원천)

```sql
-- 유예 저장 확인 (시나리오 14)
select id, review_hide_until from profiles where email = '<검증 계정>';

-- 1인 1리뷰 무결성 (시나리오 6)
select user_id, count(*) from review group by user_id having count(*) > 1;  -- 0행이어야 함

-- 계측 수집 확인 (원칙 III)
select event_type, count(*) from event_log
where event_type in ('community_view','review_prompt_shown','review_prompt_later',
                     'review_submit','comment_submit')
group by event_type;

-- SC-004 리뷰 작성률 (로그인 사용자 대비)
select (select count(distinct user_id) from review)::float
     / nullif((select count(*) from profiles), 0) as review_rate;
```

## 검증 후 정리

로컬 DB가 아니라 운영 Supabase를 물고 검증했다면 테스트 리뷰·댓글 행과 검증
이벤트를 삭제한다(기존 관례 — 날짜 조건으로):

```sql
delete from review  where created_at > '<검증 시작 시각>';
delete from comment where created_at > '<검증 시작 시각>';
delete from event_log where created_at > '<검증 시작 시각>'
  and event_type in ('community_view','review_prompt_shown','review_prompt_later',
                     'review_submit','comment_submit');
update profiles set review_hide_until = null where email = '<검증 계정>';
```
