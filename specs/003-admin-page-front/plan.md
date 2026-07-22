# Implementation Plan: 관리자 어드민 페이지 — 프론트엔드

**Branch**: `feat/adminpage-front` (워크트리 `adminpage-front`) | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-admin-page-front/spec.md`

## Summary

관리자 전용 어드민 영역(`/admin`)을 기존 React SPA에 lazy 라우트로 추가한다.
v1 범위는 US1~US3 전부: KR 지표 대시보드(수동 SQL 실행 대체), 곡 카탈로그 점검·보정,
사용자·권한 관리. 백엔드는 **별도 워크트리**에서 병렬 구현되므로, 프론트는
[contracts/admin-api.md](./contracts/admin-api.md)를 계약 정본으로 삼아 mock
(`adminMock.ts`, 기존 searchMock 패턴)으로 전 화면을 독립 완성·검증한다.
기존 공유 파일 수정은 2건(router.tsx 라우트 1블록, track.ts visit 오염 가드 2줄)으로
최소화한다.

## Technical Context

**Language/Version**: TypeScript 5 + React 19 (Vite) — 기존 frontend 스택 그대로

**Primary Dependencies**: React Router(lazy route), TanStack Query(서버 상태),
Zustand(authStore 재사용), Axios(기존 `lib/api.ts` 인터셉터 — JWT·X-Session-Id 자동),
Tailwind v4 + shadcn/ui + 기존 디자인 토큰(ink/flame/iris). **신규 의존성 0**
(차트 라이브러리 미도입 — research R3)

**Storage**: N/A (프론트) — 서버 데이터는 기존 테이블(event_log·music·profiles)만 사용,
신규 테이블·컬럼 없음. 어드민 API는 계약 문서 기준으로 백 트리가 제공

**Testing**: `tsc + vite build` + `oxlint` + quickstart mock 시나리오 12종 수동 검증
(기존 프론트 관행 — 테스트 러너 미도입, research R8)

**Target Platform**: 웹 SPA(Vercel 배포 동일) — 어드민은 데스크톱 우선·반응형 열람
(기존 max-w-md 모바일 셸의 의도적 예외)

**Project Type**: web (모노레포 frontend/ — 본 트리는 프론트만, 백엔드는 별도 트리)

**Performance Goals**: 대시보드 = 단일 지표 요청 1회(research R2, 콜드스타트 대비) →
응답 후 1s 내 렌더. 어드민 청크 lazy 분리로 일반 사용자 초기 번들 증가 0

**Constraints**: mock 모드로 백엔드 없이 전 화면 동작(FR-009) · 어드민 영역 계측
이벤트 발화 0(FR-012) · 기존 공유 파일 수정 최소(충돌 방지 — 스펙 Assumption) ·
raw 에러 노출 금지(FR-010)

**Scale/Scope**: 관리자 1인 · 화면 3종(대시보드/카탈로그/사용자) + 셸 1종 ·
곡 수백~수천 행, 사용자 수십 행(페이지 20)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 도메인 중심 아키텍처 | ✅ Pass | 계약이 DTO 전용·표준 에러 바디 명시(계약 §0). 인가는 앱 계층(@PreAuthorize + role) — 백 트리 구현 노트에 명시. 프론트도 features/admin 단위 응집 |
| II. 계약 우선·문서 위계 | ⚠️ 예외 2건 | "한 브랜치·한 PR"·"실행 PRD 동시 갱신" 위반 — Complexity Tracking에 정당화. 계약 우선 원칙 자체는 contracts/admin-api.md 단일 정본으로 **더 강하게** 준수 |
| III. 측정 가능성 기본 탑재 | ⚠️ 예외 1건 | 어드민은 계측 이벤트를 발화하지 않음(FR-012) — Complexity Tracking에 정당화 |
| IV. 프라이버시·저작권 가드레일 | ✅ Pass | 커버는 핫링크 URL 문자열만·업로드 없음(FR-007), 개인 데이터 열람 기능 없음(FR-011), 오디오·ACR 키 무관 |
| V. 게스트 우선 접근 | ✅ Pass | 게스트 핵심 기능 무영향(FR-002·SC-005). 인증은 기존 Supabase 세션 재사용 — 자체 로그인 없음 |
| VI. 외부 의존 없는 테스트 가능성 | ✅ Pass | adminMock으로 백엔드 없이 전 화면 검증(FR-009), 게이트 = build·lint + mock 시나리오(quickstart §C) |

**Post-Phase-1 재평가**: 설계 산출물(계약·데이터 모델·quickstart) 반영 후에도 위
판정 유지 — 예외 2건은 아래 Complexity Tracking으로 정당화 완료. 게이트 통과.

## Project Structure

### Documentation (this feature)

```text
specs/003-admin-page-front/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 결정 R1~R8
├── data-model.md        # Phase 1 — 뷰 모델·검증 규칙·mock 시나리오
├── quickstart.md        # Phase 1 — mock/실서버 검증 가이드(SC 매핑)
├── contracts/
│   └── admin-api.md     # Phase 1 — 어드민 API 계약 정본(백 트리 공유 기준)
└── tasks.md             # Phase 2 (/speckit-tasks 산출 — 본 명령 범위 아님)
```

### Source Code (repository root)

```text
frontend/src/
├── pages/admin/                  # ★신규 — 어드민 화면(사용자 pages와 분리)
│   ├── AdminLayout.tsx           #   가드 + 데스크톱 셸(상단 탭: 대시보드/카탈로그/사용자)
│   ├── AdminDashboardPage.tsx    #   US1 — 지표 대시보드
│   ├── AdminMusicPage.tsx        #   US2 — 곡 카탈로그 목록·필터·수정
│   └── AdminUsersPage.tsx        #   US3 — 사용자 목록·역할 변경
├── features/admin/               # ★신규 — 어드민 도메인 로직
│   ├── types.ts                  #   계약 1:1 타입(AdminMetrics·MusicAdminItem·UserAdminItem·PageResponse)
│   ├── api.ts                    #   admin API 클라이언트(mock 위임 → 실 API)
│   ├── useAdminGuard.ts          #   checking/denied/granted 판별(useMe.role + authStore initialized)
│   ├── MetricStat.tsx            #   스탯 타일(목표 대비 pass/fail)
│   └── BarList.tsx               #   분포·추이용 수평 바(신규 차트 의존성 없음 — R3)
├── mock/
│   └── adminMock.ts              # ★신규 — MOCK_ADMIN_ENABLED + 시나리오 4종(계약 예시와 동일 데이터)
├── routes/router.tsx             # ✏️수정 — /admin lazy 라우트 1블록 추가 (유일한 라우팅 접점)
└── features/events/track.ts      # ✏️수정 — trackVisitOnce에 /admin 경로 가드 2줄 (FR-012)
```

**Structure Decision**: 기존 관례(pages/ + features/<도메인>/) 그대로 확장. 신규 파일
8종 + 기존 파일 수정 2건(router.tsx·track.ts)이 전부 — 백 트리(backend/ 전용 변경)와
파일 교집합 0을 유지한다. `.specify/feature.json`만 양 트리 공통 접점(1줄, 해소 자명).

## Complexity Tracking

> Constitution Check 예외 정당화 (원칙 II·III)

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 원칙 II "API와 화면은 한 브랜치·한 PR" — 프론트·백을 별도 워크트리·별도 PR로 분리 | 사용자 결정(병렬 개발). 어드민은 신규 격리 영역이라 화면·API가 독립 병합돼도 기존 기능이 깨지지 않음(mock으로 프론트 단독 동작 — FR-009) | 한 브랜치 통합 개발: 두 세션 병렬 작업이 불가능해짐. 계약 불일치 리스크는 contracts/admin-api.md **단일 정본**(스펙 디렉터리 내 신규 파일 — 공유 문서 충돌 0) + mock=계약 예시 동일 유지로 상쇄 |
| 원칙 II "실행 PRD §6.1↔§8 동시 갱신" — 어드민 계약을 실행 PRD에 즉시 반영하지 않음 | 양 트리가 같은 PRD 파일을 동시 수정하면 병합 충돌 확실. 계약은 contracts/admin-api.md가 정본 역할 수행 | PRD 즉시 갱신: 충돌 유발이 곧 리스크. 대신 **양쪽 병합 후 별도 문서 PR 1회**로 §6.1↔§8 동기화(스펙 Assumption에 명시) — 문서 위계 최종 상태는 동일 |
| 원칙 III "신규 기능은 지표 계측 동반" — 어드민은 계측 이벤트 미발화(FR-012) | 어드민은 지표의 **소비자**(내부 운영 도구·관리자 1인). 발화하면 KR3 분모 오염(개발 세션 오염이 운영에서 실측된 문제) — 원칙 III의 목적(제품 지표 신뢰성)을 지키기 위한 미계측 | 어드민도 계측 후 서버 필터링: 어드민 세션을 식별할 표식이 없어 필터 불가능. 미발화가 정공법(SC-006로 검증) |
