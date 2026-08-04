# Implementation Plan: 웹검색 심층 곡 탐색 (더 깊이 찾기)

**Branch**: `feat/m5-web-search-escalation` (spec dir `004-web-search-escalation`) | **Date**: 2026-08-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-web-search-escalation/spec.md`

## Summary

AI 폴백 검색(spec 002)이 무결과이거나 후보가 불만족일 때, 로그인 사용자가 명시적으로
실행하는 "더 깊이 찾기" — OpenAI **Responses API + web_search 도구**를 RestClient로 직접
호출(Spring AI 1.1.8은 Chat Completions라 불가)해 웹 최신 정보 기반 후보를 얻고, 기존
메타 대조 체인을 **필터가 아닌 라벨**로 적용한다: 카탈로그 확인 실패 후보도 제외하지 않고
`verified=false`("미확인")로 노출하며, 웹이 찾아온 유튜브 링크를 표시·저장에 사용한다.
실행 전 확인 단계(질의 프리필·남은 횟수 고지), 서버 예산 웹호출 22s+메타 8s≈30s,
클라 타임아웃 35s, 사용자당 2회/일 독립 쿼터(event_log 카운트 재사용), 계측
`deep_search_*` 4종을 같은 PR로 출고한다.

## Technical Context

**Language/Version**: Java 21 (Spring Boot 3.5.x) / TypeScript 5.x (React 19, Vite 8)

**Primary Dependencies**: backend — Spring Web·Security(JWKS)·Data JPA, Spring AI 1.1.8
(기존 폴백 경로 유지; 본 기능은 **RestClient로 Responses API 직접 호출**), Lombok /
frontend — React Router 7, TanStack Query 5, Axios, Tailwind v4 + shadcn/ui, Framer Motion

**Storage**: Supabase PostgreSQL — **신규 테이블 없음**. event_log(쿼터 원장·계측),
search_history(Type 값 추가), music(source 값 추가) 재사용

**Testing**: JUnit 5 + Mockito (backend, 현 83건 GREEN), Vitest (frontend, 현 35건)

**Target Platform**: Vercel(frontend) + Render(backend, Docker, 무료 티어 콜드스타트 유의)

**Project Type**: 모노레포 웹앱 (backend/ + frontend/)

**Performance Goals**: 심층 탐색 p95 ≤ 30s (SC-003). 서버 예산: 웹검색 호출 컷 22s
(실측 발동 시 19~21.5s) + 메타 대조 소프트 데드라인 8s(기존 값 재사용) ≈ 최악 30s.
클라 하드 타임아웃 35s(F4). 기존 AI 폴백·기본 검색 경로 지연 무변화

**Constraints**: 발동 시 회당 ~80~110원 → 로그인 전용 + 사용자당 2회/일 쿼터로 총액 캡
(SC-004). 웹검색 1회 호출(2회 샘플링 미적용 — 비용). OPENAI_API_KEY는 기존
`spring.ai.openai.api-key` 재사용(서버 전용)

**Scale/Scope**: 베타 10~20명. 화면 신규 0(기존 `/search/:mode` 폴백 Phase 내부 단계 추가),
백엔드 엔드포인트 3개 추가

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|------|------|------|
| I. 도메인 중심 아키텍처 | ✅ PASS | search 도메인 내 확장(client/service/web/dto). DTO 계약만 노출, 표준 에러 바디 재사용. 인가는 SecurityConfig `authenticated` + 앱 계층(쿼터는 JWT sub 기준) |
| II. 계약 우선·문서 위계 | ✅ PASS(의무 부착) | [contracts/search-deep-api.md](./contracts/search-deep-api.md)가 계약 정본 초안. 구현 PR에서 backend-prd §6.1·frontend-prd §8 **동일 반영 의무**(이벤트 4종·API 3개·타입 변경) |
| III. 측정 기본 탑재 | ✅ PASS | `deep_search_request`에 web_ms/meta_ms/total_ms/candidates/unverified/outcome 기록, open/select/cancel 클라·서버 이벤트 — 같은 PR 출고(FR-009) |
| IV. 프라이버시·저작권 (NON-NEGOTIABLE) | ✅ PASS | 키 서버 전용(기존 env 재사용), 이 경로에 오디오 자체가 없음(텍스트만, FR-010), 이미지는 핫링크 URL만(ytimg 파생 폴백 — 재호스팅 없음) |
| V. 게스트 우선 접근 | ✅ PASS | 핵심 기능(기본 검색·결과 조회·AI 폴백)의 게스트 접근 무변화. 심층 탐색은 회당 비용이 큰 **부가 구제 기능**으로 저장 계열과 같은 로그인 분류(스펙 Clarifications 2026-08-04 확정). 원칙 V가 게스트를 요구하는 "핵심 기능" 열거에 미포함 — 위반 아님 |
| VI. 외부 의존 없는 테스트 가능성 | ✅ PASS | `MockWebSongFinderClient`(@Profile("ai-mock")) + `DEEP_MOCK_SCENARIO` 5종(hit/unverified/empty/error/slow)으로 실호출 없이 전 흐름 E2E 검증(FR-011) |

**Post-Phase 1 재평가**: 설계 산출물(계약·데이터 모델) 확정 후에도 위 판정 변화 없음 —
신규 테이블·신규 도메인·계약 파괴 없음, 게이트 통과.

## Project Structure

### Documentation (this feature)

```text
specs/004-web-search-escalation/
├── plan.md              # 이 파일
├── research.md          # Phase 0 — 기술 결정 R1~R10
├── data-model.md        # Phase 1 — 엔티티·이벤트·상태 정의
├── quickstart.md        # Phase 1 — mock/실키 검증 시나리오
├── contracts/
│   └── search-deep-api.md   # Phase 1 — API·이벤트 계약(§6.1 동기화 원본)
└── tasks.md             # Phase 2 (/speckit-tasks — 이 명령이 만들지 않음)
```

### Source Code (repository root)

```text
backend/src/main/java/com/melolist/
├── search/
│   ├── client/
│   │   ├── WebSongFinderClient.java          # 신규 — 웹검색 후보 식별 인터페이스
│   │   ├── WebSongCandidate.java             # 신규 — AiSongCandidate + 웹 근거 youtubeVideoId
│   │   ├── OpenAiWebSongFinderClient.java    # 신규 — Responses API 직접 호출(@Profile("!ai-mock"))
│   │   └── mock/MockWebSongFinderClient.java # 신규 — DEEP_MOCK_SCENARIO 5종(@Profile("ai-mock"))
│   ├── service/
│   │   ├── DeepSearchService.java            # 신규 — 쿼터→웹검색→메타 라벨링→응답 / select
│   │   ├── CandidateMetaVerifier.java        # 신규 — TextSearchService의 3단 대조·동명이곡
│   │   │                                     #   차단 로직 추출(양 서비스 공용, 동작 무변화)
│   │   ├── TextSearchService.java            # 수정 — 추출된 Verifier 사용(리팩터링만)
│   │   └── AiQuotaService.java               # 수정 — deep 한도 검사·잔여 조회 메서드 추가
│   ├── config/AiProperties.java              # 수정 — deep { timeoutMs=22000, userDaily=2 }
│   ├── domain/SearchHistory.java             # 수정 — Type.DEEP 추가(varchar(20), 무마이그레이션)
│   ├── dto/
│   │   ├── SearchResponse.java               # 수정 — TrackResult에 verified(Boolean,
│   │   │                                     #   NON_NULL — 기존 경로 직렬화 무변화)
│   │   └── DeepSelectRequest.java            # 신규 — candidate(+verified)+rank
│   └── web/SearchController.java             # 수정 — /deep, /deep/select, /deep/quota
├── common/config/SecurityConfig.java         # 수정 — /api/search/deep/** authenticated
│                                             #   (와일드카드 permitAll보다 앞 — spec 001 교훈)
└── music/                                    # 무수정 — upsert에 source="WEB"만 전달

backend/src/test/java/com/melolist/search/
├── service/DeepSearchServiceTest.java        # 신규
├── service/CandidateMetaVerifierTest.java    # 신규(기존 TextSearchServiceTest에서 이관분 포함)
└── client/OpenAiWebSongFinderClientTest.java # 신규 — 응답 파싱·videoId 검증

frontend/src/features/search/
├── DeepSearchFlow.tsx                        # 신규 — confirm/searching/candidates/empty/
│                                             #   error/quota 단계 상태머신
├── FallbackSearchView.tsx                    # 수정 — empty·candidates 상태에 진입점 2곳
├── api.ts                                    # 수정 — deepQuota()/deepSearch()/selectDeepCandidate()
│                                             #   (타임아웃 35s)
├── types.ts                                  # 수정 — AcrResult.verified?: boolean
└── (SearchPage.tsx)                          # 수정 — 게스트 로그인 유도·복귀 연계(기존 패턴)

docs/prd/backend-prd.md · frontend-prd.md     # 수정 — §6.1/§8 계약 동기화(같은 PR, 원칙 II)
```

**Structure Decision**: 기존 search 도메인 내부 확장. 별도 도메인·모듈을 만들지 않는다 —
심층 탐색은 AI 폴백의 에스컬레이션 티어로 같은 계약 체계(SearchResponse·ai-key·이벤트
패턴)를 공유하기 때문. 메타 대조 로직은 TextSearchService에서 `CandidateMetaVerifier`로
추출해 두 파이프라인이 공용한다(002 동작 무변화가 추출의 수용 기준).

## Complexity Tracking

> 위반 없음 — Constitution Check 전 항목 PASS. 표 생략.
