# Implementation Plan: AI 자연어 폴백 검색

**Branch**: `002-ai-fallback-search` | **Date**: 2026-07-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-ai-fallback-search/spec.md`

## Summary

허밍/녹음 검색이 실패(미매칭·오매칭)했을 때 사용자가 자유 텍스트로 곡을 설명하면
후보 최대 5곡을 기존 검색 결과 카드 형태로 반환하는 폴백 검색.

기술 접근: **Spring AI + OpenAI(gpt-5-mini)** 로 곡 후보(제목·아티스트)를 식별하고,
**기존 ACRCloud Metadata 클라이언트(`AcrMetadataClient.lookup(track, artist, mode)`)를
재사용**해 youtube_video_id·cover_url을 해석한다. 신규 외부 의존은 OpenAI 하나뿐.
후보는 응답 시점에 저장하지 않고 **사용자가 선택한 곡만** `music`에 upsert(환각 곡
DB 오염 방지, FR-006 정합). 엔드포인트 `POST /api/search/text`는 SecurityConfig에
이미 permitAll로 예약되어 있고, `SearchHistory.Type.TEXT`·backend-prd §6.2 M5 슬롯 등
기존 확장 지점에 그대로 얹는다.

## Technical Context

**Language/Version**: Java 21 (backend, Spring Boot 3.5.16) · TypeScript/React (frontend)

**Primary Dependencies**:
- 신규: Spring AI BOM + `spring-ai-starter-model-openai` (OpenAI Chat Completions, 모델 `gpt-5-mini` — env로 교체 가능)
- 재사용: `AcrMetadataClient`(메타 해석), `EventService.recordSilently`(계측), `MusicService.upsertFromRecognition`(저장, source 파라미터 확장), 가상 스레드 병렬 enrich 패턴
- 프론트: 기존 axios 클라이언트·TanStack Query·SearchPage Phase 상태머신 확장

**Storage**: Supabase PostgreSQL — 기존 테이블 재사용(`music`, `search_history`, `event_log`). **스키마 마이그레이션 불필요** (acrid nullable unique + source 컬럼 기존재)

**Testing**: 기존 JUnit + **`ai-mock` 프로파일 신설**(acr-mock과 동일한 인터페이스+`@Profile` 쌍 패턴, `AI_MOCK_SCENARIO` 4종: hit/empty/error/slow) → 실호출 없는 E2E. 프론트는 기존 mock 시나리오 체계(`searchMock.ts`) 확장

**Target Platform**: Vercel(frontend) + Render 무료 티어(backend, 콜드스타트 유의)

**Project Type**: 웹 모노레포 (backend + frontend)

**Performance Goals**: SC-003 — 폴백 요청의 95%가 15초 내 후보/무후보 표시. 내부 예산: LLM 호출 10s 컷 + 메타 해석(기존 4s 컷, 후보별 병렬) + 프론트 타임아웃 15s(기존 `RECOGNIZE_TIMEOUT_MS` 재사용)

**Constraints**:
- 비용 한도: 게스트 3회/일(세션 기준) · 로그인 10회/일(계정 기준), event_log 카운트로 검사, 초과 시 429 표준 에러 바디
- Render 콜드스타트·Hikari 풀 5 캡 유지(폴백은 저빈도라 커넥션 부담 미미)
- OpenAI 키는 서버 env(.env 미추적)만, 오디오는 폴백 경로에서 미전송(텍스트만)

**Scale/Scope**: 베타 소규모(일 수십 쿼리 예상). 화면 신규 1(폴백 입력+후보 목록), 백엔드 엔드포인트 신규 2(`POST /api/search/text`, `POST /api/search/text/select`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | 원칙 | 판정 | 근거 |
|---|------|------|------|
| I | 도메인 중심 아키텍처 | ✅ PASS | search 도메인 내 확장(`search.client`, `search.service`, DTO 계약만 노출). 표준 에러 바디 `{code,message,details}` 사용. Entity 직접 노출 없음. JPA 단일 접근 유지 |
| II | 계약 우선·문서 위계 | ✅ PASS | `contracts/search-text-api.md` 작성 → 구현 PR에서 backend-prd §6.1·frontend-prd §8 **동시 갱신**을 태스크로 강제. API+화면 한 브랜치·한 PR |
| III | 측정 가능성 기본 탑재 | ✅ PASS | `ai_search_request`(구간 타이밍 포함)·`ai_search_select`(rank) 서버 기록 + 클라 이벤트 2종. 같은 마일스톤 내 출고(FR-009). SC 산출 SQL 가능 |
| IV | 프라이버시·저작권 (NON-NEGOTIABLE) | ✅ PASS | 오디오 미전송·미저장(텍스트만, FR-012). OpenAI 키 서버 env 전용(FR-011). 커버는 기존 `resolveCoverUrl` 핫링크 3단 폴백 재사용 — 프록시·재호스팅 없음 |
| V | 게스트 우선 접근 | ✅ PASS | 폴백 검색·후보 조회는 게스트 즉시 사용(일 3회 한도 내). 저장 계열(즐겨찾기·기록)은 기존 로그인 규칙 그대로 |
| VI | 외부 의존 없는 테스트 가능성 | ✅ PASS | `ai-mock` 프로파일 + 시나리오 4종으로 실호출 없는 E2E(FR-013). main 병합 게이트(빌드+validate+mock E2E) 기존 그대로 |

**Post-Phase 1 재평가 (2026-07-21)**: 설계 산출물(data-model·contracts) 반영 후 위반
없음 — 신규 테이블 0, 신규 외부 의존 1(OpenAI), 기존 패턴(인터페이스+Profile 쌍,
recordSilently, 표준 에러 바디) 준수 확인. Complexity Tracking 기재 사항 없음.

## Project Structure

### Documentation (this feature)

```text
specs/002-ai-fallback-search/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 기술 결정·근거
├── data-model.md        # Phase 1 — 데이터 모델(기존 재사용 + 변경점)
├── quickstart.md        # Phase 1 — 검증 가이드
├── contracts/
│   └── search-text-api.md   # Phase 1 — API 계약 + 이벤트 사전 추가분
└── tasks.md             # Phase 2 (/speckit-tasks — 본 커맨드 산출 아님)
```

### Source Code (repository root)

```text
backend/
├── build.gradle                                  # [수정] Spring AI BOM + starter
└── src/main/
    ├── resources/application.yml                 # [수정] spring.ai.openai.* + melolist.ai.*
    └── java/com/melolist/
        ├── search/
        │   ├── web/SearchController.java         # [수정] POST /text, POST /text/select 추가
        │   ├── service/
        │   │   ├── TextSearchService.java        # [신규] 폴백 오케스트레이션(LLM→메타 병렬→응답)
        │   │   └── AiQuotaService.java           # [신규] event_log 카운트 기반 일일 한도
        │   ├── client/
        │   │   ├── AiSongFinderClient.java       # [신규] 인터페이스(후보 식별 계약)
        │   │   ├── OpenAiSongFinderClient.java   # [신규] @Profile("!ai-mock"), Spring AI ChatClient
        │   │   └── mock/MockAiSongFinderClient.java  # [신규] @Profile("ai-mock"), 시나리오 4종
        │   ├── config/AiProperties.java          # [신규] melolist.ai.* 바인딩
        │   └── dto/                              # [신규] TextSearchRequest/Response, TextSelectRequest
        ├── music/
        │   ├── service/MusicService.java         # [수정] upsert에 source 전달
        │   └── dto/MusicUpsertCommand.java       # [수정] source 필드 추가
        └── event/repository/EventLogRepository.java  # [수정] 일일 카운트 쿼리 추가

frontend/src/
├── features/search/
│   ├── FallbackSearchView.tsx                    # [신규] 텍스트 입력 + 후보 목록 화면
│   ├── ResultsView.tsx                           # [수정] "찾는 곡이 아닌가요?" 진입점
│   ├── FailureView.tsx                           # [수정] 미매칭(F2)에 "말로 설명해서 찾기" CTA
│   ├── api.ts                                    # [수정] textSearch()/selectCandidate()
│   └── types.ts                                  # [수정] score nullable 등 후보 타입
├── features/events/track.ts                      # [수정] EventType에 ai_* 추가
├── mock/searchMock.ts                            # [수정] ai 폴백 mock 시나리오
└── pages/SearchPage.tsx                          # [수정] Phase 상태머신에 fallback 단계 추가
```

**Structure Decision**: 웹 모노레포 기존 구조 유지. 백엔드는 search 도메인 내부 확장만
수행(신규 도메인 패키지 없음 — 원칙 I의 도메인 경계 준수). 프론트는 `/search/:mode`
플로우 내부에서 폴백 화면을 상태(Phase)로 처리하고 신규 라우트는 만들지 않는다
(폴백은 검색 실패 맥락에서만 진입 — spec Assumptions의 "폴백 전용 범위"와 일치).

## Complexity Tracking

> Constitution Check 위반 없음 — 기재 사항 없음.
