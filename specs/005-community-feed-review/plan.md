# Implementation Plan: 커뮤니티 — 공개 탐색 피드·서비스 리뷰·댓글

**Branch**: `feat/m4-community` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-community-feed-review/spec.md`

## Summary

커뮤니티 탭(하단 내비 5번째)을 신설해 세그먼트 전환으로 공개 플레이리스트 피드와
서비스 리뷰 피드를 게스트 포함 누구나 조회하게 하고, 로그인 사용자에게 서비스 리뷰
(1인 1건·별점 1~5·500자)와 공개 플레이리스트 댓글(300자)을 제공하며, 누적 검색 3회
시 리뷰 유도(서버 유예 7일)를 띄운다.

**기술 접근**(Phase 0 실사 — [research.md](./research.md)): 백엔드 community 도메인은
M2 스캐폴드에서 이미 구현되어 있고 운영 DB에 `review`·`comment` 테이블이 존재한다
(신규 마이그레이션 0). 백엔드는 갭 5건만 메운다 — ①리뷰 500자·댓글 300자 `@Size`
검증(R2) ②공개 피드 응답에 작성자 요약 추가(R4) ③`GET /api/reviews/prompt` 유도
판정(R5) ④`PATCH /api/users/me/review-visibility` 유예 저장(R6) ⑤CommentService
테스트 백필. 실질 작업량은 **프론트가 지배**: 커뮤니티 화면·리뷰 폼/유도 시트·댓글
섹션 전부 신규(기존 코드 0건), 기존 목록·시트·게스트 유도 패턴을 복사 재사용한다.

## Technical Context

**Language/Version**: Backend Java 21(LTS)·Spring Boot 3.5 / Frontend React+TypeScript(Vite)

**Primary Dependencies**: Spring Data JPA·Spring Security(JWKS)·Bean Validation /
React Router·TanStack Query(useInfiniteQuery)·Zustand·Axios·Tailwind v4+토큰·motion

**Storage**: Supabase PostgreSQL — 기존 `review`·`comment`·`profiles.review_hide_until`
재사용, **신규 테이블·마이그레이션 0**

**Testing**: backend JUnit+Mockito 서비스 단위(현 135건 GREEN 유지+추가) / frontend
vitest(현 40건 유지+추가) — 병합 게이트: build+validate+테스트 GREEN(원칙 VI)

**Target Platform**: 모바일 우선 웹(max-w-md), Vercel(frontend)+Render(backend)

**Project Type**: web application 모노레포(`backend/` + `frontend/`) — API·화면 동시
변경이므로 한 브랜치·한 PR(원칙 II)

**Performance Goals**: SC-006 피드 첫 페이지 3초 이내(웜) — 페이지 20건·작성자 요약
페이지 단위 일괄 조회(N+1 방지, R4)

**Constraints**: 게스트 조회 허용(SecurityConfig 기존 매핑 이미 개방 — R1), 오류는
표준 바디+정제 카피(F4), 사용자 텍스트는 플레인 렌더·`dangerouslySetInnerHTML` 금지(R9)

**Scale/Scope**: 베타 코호트 10~20명 전제. 화면 1신설(커뮤니티)+1확장(플레이리스트
상세 댓글), 백엔드 갭 5건, 신규 이벤트 5종

## Constitution Check

*GATE: constitution v1.0.1 기준 — Phase 0 전 평가, Phase 1 설계 후 재평가 완료.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 도메인 중심 아키텍처 | ✅ PASS | community 도메인 내 확장. 교차 도메인 접근은 서비스 위임(기존 `PlaylistService.getPublicPlaylists`·`assertViewable` 재사용). DTO로만 노출, 오류 표준 바디, 인가는 앱 계층(작성자 검사 403 — R8), JPA 단일 |
| II. 계약 우선·문서 위계 | ✅ PASS(조건) | 계약 정본 [contracts/community-api.md](./contracts/community-api.md). **backend-prd §6.1/§6.2와 frontend-prd §8(이벤트 사전 포함)을 같은 PR에서 갱신하는 태스크 필수** |
| III. 측정 가능성 기본 탑재 | ✅ PASS | 신규 이벤트 5종(R7)을 같은 마일스톤에서 구현. SC-004·SC-005가 event_log SQL로 산출 가능 |
| IV. 프라이버시·저작권 가드레일 | ✅ PASS | 오디오·시크릿·이미지 재호스팅 무관 — 사용자 텍스트만 다룸 |
| V. 게스트 우선 접근 | ✅ PASS | 피드·댓글 조회 게스트 허용, 작성 계열만 로그인. 1인 1리뷰·중복 409 유지(원칙 명문 그대로) |
| VI. 외부 의존 없는 테스트 가능성 | ✅ PASS | 외부 API 신규 0 — mock 프로파일 불필요. 기존 게이트(build+validate+테스트)로 충분 |

**Post-design 재평가**: 위반 없음 — Complexity Tracking 해당 없음.

## Project Structure

### Documentation (this feature)

```text
specs/005-community-feed-review/
├── plan.md              # 이 파일
├── research.md          # Phase 0 — 기존 자산 실사·결정 R1~R10
├── data-model.md        # Phase 1 — 엔티티·검증 규칙(전부 기존, 변경분 표시)
├── quickstart.md        # Phase 1 — E2E 검증 가이드
├── contracts/
│   └── community-api.md # Phase 1 — 프론트 소비 계약 정본
└── tasks.md             # Phase 2 (/speckit-tasks — 이 명령이 만들지 않음)
```

### Source Code (repository root)

```text
backend/src/main/java/com/melolist/
├── community/
│   ├── web/CommunityController.java        # 수정 — 피드 응답을 작성자 요약 포함형으로
│   ├── web/ReviewController.java           # 수정 — GET /api/reviews/prompt 추가(/{id}보다 먼저 선언)
│   ├── service/CommunityService.java       # 신설 — 공개 피드 + 작성자 일괄 조회(R4)
│   ├── service/ReviewService.java          # 수정 — 유도 판정(prompt) 로직(R5)
│   ├── dto/CommunityDtos.java              # 신설 — CommunityPlaylistResponse
│   ├── dto/ReviewDtos.java                 # 수정 — content @Size(500), PromptResponse
│   └── dto/CommentDtos.java                # 수정 — content @Size(300)
├── user/
│   ├── web/UserController.java             # 수정 — PATCH /users/me/review-visibility(R6)
│   ├── service/UserService.java            # 수정 — 유예 저장 + 프로필 일괄 조회
│   └── dto/ReviewVisibilityRequest.java    # 신설 — 유예 요청 레코드(관례: 레코드별 파일)
├── search/repository/SearchHistoryRepository.java  # 수정 — countByUserId 추가(R5)
└── (application.yml)                       # melolist.review: prompt-defer-days=7, prompt-search-threshold=3

backend/src/test/java/com/melolist/
├── community/service/ReviewServiceTest.java    # 수정 — prompt 판정 케이스 추가
├── community/service/CommentServiceTest.java   # 신설 — 백필(R1 갭)
└── community/service/CommunityServiceTest.java # 신설 — 작성자 일괄 조회 매핑

frontend/src/
├── components/BottomNav.tsx                # 수정 — TABS에 커뮤니티(5탭)
├── routes/router.tsx                       # 수정 — TabLayout 자식 /community
├── pages/CommunityPage.tsx                 # 신설 — 세그먼트(플레이리스트/리뷰)+피드 2종
├── pages/PlaylistDetailPage.tsx            # 수정 — 트랙 목록 아래 댓글 섹션 부착
├── pages/SearchPage.tsx                    # 수정 — 결과 표시 시 유도 판정 호출(로그인만)
├── features/community/
│   ├── api.ts                              # 신설 — 타입(snake_case)+API 함수
│   ├── ReviewFormSheet.tsx                 # 신설 — 작성/수정 시트(별점+텍스트 500자)
│   ├── ReviewPromptSheet.tsx               # 신설 — 리뷰 유도(작성하기/나중에)
│   └── CommentsSection.tsx                 # 신설 — 목록+입력(300자)+본인 삭제
└── features/events/track.ts                # 수정 — EventType 5종 추가(R7)
```

**Structure Decision**: 기존 모노레포 웹 구조 그대로. 백엔드는 community 도메인
패키지 관례(web/service/dto), 프론트는 feature 폴더 관례(`features/community/` 신설
— favorites·history와 동형)를 따른다. 재사용 캐논: 목록 화면 뼈대·useInfiniteQuery
"더 보기" 패턴(FavoritesPage), 카드 로우(PlaylistsPage `PlaylistRow`), 시트 셸
(`components/BottomSheet.tsx`)+폼 관행(PlaylistFormSheet), 게스트 유도
(`features/user/GuestPrompt.tsx`, 댓글 입력부는 인라인 CTA 변형), `authStore.initialized`
가드, 별점 색은 기존 `--color-warning`(amber) 토큰.

## 설계 유의점 (Phase 1 요약)

- **세그먼트 UI**: shadcn `ui/tabs.tsx`는 앱 화면 사용 사례가 없어(admin 포함 미사용)
  기존 관행대로 수동 2버튼 세그먼트(`bg-secondary` 컨테이너)로 구현 — 첫 소비자 리스크 회피.
- **`/api/reviews/prompt` 경로는 `/{id}` 매핑보다 먼저 선언**(기존 `/me`와 같은 함정).
- **케이싱 주의**: community·reviews·comments 응답은 snake_case, `/users/me` 계열만
  camelCase(기존 관례) — 프론트 타입 작성 시 혼동 금지.
- **댓글 `parent_id`는 계약상 "예약"** — v1 프론트는 보내지도 그리지도 않는다(R3).
- **이벤트 타입은 서버 자유 문자열**(`@NotBlank`만) — 프론트 `EventType` 유니온과
  PRD 이벤트 사전 갱신이 실질 게이트.
- **XSS 회귀 방지**: 리뷰·댓글 렌더 경로에 `dangerouslySetInnerHTML` 금지, 줄바꿈은
  `whitespace-pre-wrap`(R9).

## Complexity Tracking

> Constitution Check 위반 없음 — 해당 없음.
