# Tasks: 관리자 어드민 페이지 — 프론트엔드

**Input**: Design documents from `/specs/003-admin-page-front/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/admin-api.md, quickstart.md

**Tests**: 테스트 러너 미도입(research R8) — 테스트 태스크 대신 각 스토리에 quickstart
mock 시나리오 검증 태스크를 둔다. 게이트는 build + oxlint + 시나리오 통과.

**Organization**: 유저 스토리 단위 페이즈 — 각 스토리는 독립 구현·독립 검증 가능.

**충돌 방지 리마인더**: 기존 파일 수정은 `routes/router.tsx`·`features/events/track.ts`
2건뿐이어야 한다(plan Structure Decision). 그 외는 전부 신규 파일. `backend/` 하위는
절대 건드리지 않는다(어드민 백 트리 소관).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능(다른 파일·미완 태스크 의존 없음)
- **[Story]**: US1(대시보드) / US2(곡 카탈로그) / US3(사용자·권한)

---

## Phase 1: Setup

**Purpose**: 계약 타입 확정 — 이후 모든 파일이 이 타입을 import한다

- [x] T001 계약 1:1 타입 정의 — `frontend/src/features/admin/types.ts`:
      `AdminMetrics`(kr2/kr2_breakdown/kr3/failures/weekly/totals — completion_pct는
      `number | null`), `MusicAdminItem`, `UserAdminItem`(`role: 'USER' | 'ADMIN'`),
      `PageResponse<T>`(snake_case), 목록 쿼리 파라미터 타입(`missing: 'video' | 'cover'`).
      contracts/admin-api.md의 필드명·null 허용과 완전 일치시킬 것

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: mock·API 클라이언트·가드·셸·라우트·계측 가드 — 모든 스토리의 전제

**⚠️ CRITICAL**: 이 페이즈 완료 전에는 어떤 유저 스토리도 시작 불가

- [x] T002 mock 모듈 생성 — `frontend/src/mock/adminMock.ts`: `MOCK_ADMIN_ENABLED`
      토글 + 시나리오 상수(`normal`/`empty`/`error`/`slow`, data-model §6) +
      계약 예시 응답과 동일한 데이터(metrics·music 목록·users 목록) + 수정
      mock(PATCH music/role 반영 흉내, self-demotion 409 흉내). searchMock.ts 패턴
      계승: mock 비활성 시 null 반환
- [x] T003 admin API 클라이언트 — `frontend/src/features/admin/api.ts`: 기존
      `lib/api.ts`의 axios 인스턴스 재사용. `fetchAdminMetrics(days)`,
      `fetchAdminMusic(params)`, `updateAdminMusic(id, patch)`, `fetchAdminUsers(params)`,
      `updateAdminUserRole(id, role)`. 각 함수는 먼저 adminMock에 위임
      (`import.meta.env.DEV` 가드 + 동적 import — 프로덕션 번들 제외), null이면 실 API 호출
- [x] T004 [P] 접근 가드 훅 — `frontend/src/features/admin/useAdminGuard.ts`:
      data-model §5의 checking/denied/granted 판별. authStore `initialized` 대기(기존
      가드 패턴) + `useMe(로그인시)` → `role !== 'ADMIN'`이면 denied. denied 시 홈(`/`)
      조용한 리다이렉트(존재 비노출 — R5)
- [x] T005 어드민 셸 — `frontend/src/pages/admin/AdminLayout.tsx`: useAdminGuard 적용
      (checking=스피너, granted만 렌더), 데스크톱 우선 와이드 레이아웃(기존 max-w-md
      예외), 상단 탭 내비(대시보드/카탈로그/사용자, NavLink) + `<Outlet/>`. 기존 ink
      토큰·shadcn 재사용, BottomNav 미포함
- [x] T006 [P] 페이지 스텁 3종 — `frontend/src/pages/admin/AdminDashboardPage.tsx`,
      `frontend/src/pages/admin/AdminMusicPage.tsx`,
      `frontend/src/pages/admin/AdminUsersPage.tsx`: 제목만 있는 최소 구현(라우트 연결용,
      각 스토리 페이즈에서 본 구현)
- [x] T007 라우트 연결 — `frontend/src/routes/router.tsx`: `/admin` lazy 라우트 1블록
      추가(AdminLayout + index=dashboard, `music`, `users` 자식 라우트). React Router
      `lazy` 사용해 어드민 청크 분리(R1). **기존 라우트 블록은 수정 금지**
- [x] T008 [P] visit 오염 가드 — `frontend/src/features/events/track.ts`:
      `trackVisitOnce()` 최상단에 `location.pathname`이 `/admin`으로 시작하면 발화·
      VISITED_KEY 마킹 모두 생략(2줄, R6). **track.ts의 다른 코드 수정 금지**(FR-012)

**Checkpoint**: `npm run dev` + `/admin` 직접 진입 → 가드 동작(게스트/일반 사용자
리다이렉트, quickstart A-1·A-2) + 관리자 mock으로 탭 셸 표시. 빌드 통과

---

## Phase 3: User Story 1 - 운영 지표 대시보드 (Priority: P1) 🎯 MVP

**Goal**: KR2·KR3를 목표 대비로 한눈에 — 수동 SQL 실행 대체(SC-001)

**Independent Test**: 관리자 mock + `normal` 시나리오로 `/admin` 진입 → 지표 전 섹션
표시, 기간 변경 갱신, `empty`/`error`/`slow` 시나리오 상태 처리 확인만으로 독립 검증

### Implementation for User Story 1

- [x] T009 [P] [US1] 스탯 타일 컴포넌트 — `frontend/src/features/admin/MetricStat.tsx`:
      라벨·값·목표 대비 pass/fail 배지(pass=서버 값 사용, 프론트 재판정 금지 —
      data-model §1). 값 없음(null) 시 "데이터 없음" 표기
- [x] T010 [P] [US1] 수평 바 리스트 컴포넌트 — `frontend/src/features/admin/BarList.tsx`:
      라벨+건수+상대 폭 CSS 바(신규 차트 의존성 금지 — R3). 실패 분포·주간 추이 공용
- [x] T011 [US1] 대시보드 본 구현 — `frontend/src/pages/admin/AdminDashboardPage.tsx`:
      TanStack Query로 `fetchAdminMetrics(days)` 조회. 기간 셀렉터(7/14/30/90일, 기본
      14 — FR-004) · KR2 모드별 p50/p95/max 표+pass(FR-003) · KR3 완료율
      스탯(completion_pct null → "데이터 없음", 엣지) · 구간 분해 표(upsert는 "비동기
      측정" 주석 — 계약 §1) · 실패 분포 BarList · 주간 추이(최신 주 먼저) · 현황 요약
      4종(FR-005) · 로딩 스켈레톤/오류(정제 카피+재시도, FR-010) 상태
- [x] T012 [US1] 대시보드 mock 검증 — `specs/003-admin-page-front/quickstart.md` §A
      3~7번 시나리오 순회(정상 렌더·기간 변경·분모 0·오류 재시도·로딩), 결과를
      tasks.md 체크로 기록
- [x] T013 [US1] 가드·오염·무영향 검증 — `specs/003-admin-page-front/quickstart.md` §A
      1·2·11·12번: 게스트/일반 사용자 차단(SC-002), `/admin` 이용 중 `POST /api/events`
      0건(SC-006), 홈 진입 시 visit 정상 발화·어드민 진입점 미노출(SC-005)

**Checkpoint**: US1 = 완전한 MVP — 대시보드만으로도 배포 가치 있음

---

## Phase 4: User Story 2 - 곡 카탈로그 점검·보정 (Priority: P2)

**Goal**: 메타 누락 곡을 필터로 찾아 2분 내 보정(SC-003) — "추후 재해석"의 실현 수단

**Independent Test**: 카탈로그 탭에서 mock 목록 검색·필터 → 곡 선택 → videoId 수정
저장(검증 포함) 확인만으로 독립 검증(대시보드와 무관)

### Implementation for User Story 2

- [x] T014 [P] [US2] 곡 수정 폼 — `frontend/src/features/admin/MusicEditForm.tsx`:
      수정 가능 필드 6종(data-model §2) + 클라 검증 선차단(title 공백 불가·≤255,
      videoId `^[A-Za-z0-9_-]{11}$`, cover_url http(s)만, release_date 유효 날짜) +
      필드 단위 오류 카피(FR-010). acrid·id 등은 읽기 전용 표시. 커버 업로드 UI 금지
      (원칙 IV — URL 문자열 입력만)
- [x] T015 [US2] 카탈로그 페이지 본 구현 — `frontend/src/pages/admin/AdminMusicPage.tsx`:
      `fetchAdminMusic` 목록(20개 페이지네이션) + 검색어 입력(제목·아티스트) +
      missing 필터 토글(`video`/`cover` — FR-006) + 행 선택 → MusicEditForm(시트 또는
      인라인) → `updateAdminMusic` 저장 성공 시 응답으로 캐시 갱신(저장 후 최신 상태
      재표시 — 계약 §3 last-write-wins) + 토스트 피드백 + 빈/로딩/오류 상태
- [x] T016 [US2] 카탈로그 mock 검증 — `specs/003-admin-page-front/quickstart.md` §A
      8·9번: 검색·필터 동작, 유효 videoId 저장 반영, 11자 미달 입력 거부+사유 표시

**Checkpoint**: US1+US2 각각 독립 동작

---

## Phase 5: User Story 3 - 사용자·권한 관리 (Priority: P3)

**Goal**: 관리자 역할 부여·해제를 화면에서 — DB 직접 수정 대체

**Independent Test**: 사용자 탭에서 mock 목록 확인 → 일반 사용자 역할 변경 반영,
자기 자신 해제 버튼 비활성 확인만으로 독립 검증

### Implementation for User Story 3

- [x] T017 [US3] 사용자 페이지 본 구현 — `frontend/src/pages/admin/AdminUsersPage.tsx`:
      `fetchAdminUsers` 목록(별명·이메일·가입일·역할, 20개 페이지네이션) + 역할 변경
      액션(확인 다이얼로그 → `updateAdminUserRole`) + **자기 자신(`id === me.id`)의
      ADMIN 해제는 비활성+안내**(FR-008 클라 선차단, 서버 409는 이중 방어) + 성공 시
      캐시 갱신·토스트 + 빈/로딩/오류 상태
- [x] T018 [US3] 사용자 mock 검증 — `specs/003-admin-page-front/quickstart.md` §A
      10번: 역할 변경 반영, 자기 자신 해제 비활성 확인

**Checkpoint**: 전 스토리 독립 동작

---

## Phase 6: Polish & 최종 게이트

**Purpose**: 병합 전 게이트(constitution 원칙 VI) + 전체 검증

- [x] T019 [P] 빌드·린트 게이트 — `frontend/`에서 `npm run build`·`npm run lint` 통과
      + 빌드 출력에서 어드민 lazy 청크 분리 확인 + adminMock이 프로덕션 번들에
      미포함인지 확인(quickstart §C)
- [x] T020 quickstart §A 전체 12항목 최종 순회 + SC-001~SC-006 대응표 확인 —
      `specs/003-admin-page-front/quickstart.md`. 통과 후 커밋·PR 준비(브랜치
      `feat/adminpage-front`)
- [ ] T021 ⏸ 실서버 검증(보류) — `specs/003-admin-page-front/quickstart.md` §B:
      **어드민 백 트리 병합 후에만 수행 가능**. mock 끄고 실 API 연동, 대시보드 수치와
      `backend/db/queries/kr_metrics.sql` 수동 실행 결과 일치 확인, 비관리자 JWT 403
      확인. 본 트리 PR은 T020까지로 성립(mock 개발 완료 상태)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (T001)**: 즉시 시작 가능 — 모든 후속의 전제(타입)
- **Phase 2 (T002~T008)**: T001 이후. T002→T003 순서(모듈 의존), T004·T006·T008은
  상호 병렬, T005는 T004 이후, T007은 T005·T006 이후
- **Phase 3~5 (유저 스토리)**: Phase 2 완료 후. 스토리 간 상호 의존 없음 —
  우선순위 순(P1→P2→P3) 권장, 병렬도 가능
- **Phase 6**: 원하는 스토리 완료 후(T019·T020). T021은 백 트리 병합 대기

### User Story Dependencies

- US1(P1): Foundational만 전제 — 다른 스토리 독립
- US2(P2): Foundational만 전제 — US1과 독립(공용 컴포넌트 MetricStat·BarList 미사용)
- US3(P3): Foundational만 전제 — US1·US2와 독립

### Parallel Opportunities

```text
Phase 2: T004(가드) ∥ T006(스텁) ∥ T008(track 가드)   — 서로 다른 파일
Phase 3: T009(MetricStat) ∥ T010(BarList)             — 서로 다른 파일
Phase 4: T014(폼)는 T015(페이지) 착수와 병렬 가능
스토리 병렬: Phase 2 완료 후 US1·US2·US3 동시 진행 가능(파일 교집합 0)
```

---

## Implementation Strategy

### MVP First (US1까지)

1. Phase 1~2 완료 → 가드·셸·라우트 체크포인트 확인
2. Phase 3(US1) 완료 → **STOP & VALIDATE**: quickstart A-1~A-7·A-11·A-12
3. 이 시점에 배포 가치 성립(대시보드 = 어드민의 최우선 존재 이유)

### Incremental Delivery

- US1 검증 후 → US2(카탈로그) → US3(사용자) 순차 추가, 각 체크포인트에서 독립 검증
- 전체 완료 후 T019~T020 게이트 → 커밋·PR(프론트 단독, mock 상태로 병합 가능 —
  FR-009가 이를 보장)
- T021(실서버)은 어드민 백 트리 병합 후 후속 확인으로 처리

### 백 트리 협업 메모

- 계약 정본: `specs/003-admin-page-front/contracts/admin-api.md` — 백 트리는 이 파일
  기준으로 `/api/admin/*` 구현(스펙 002처럼 별도 스펙 번호 사용 권장: 004)
- 계약 변경이 필요해지면: 이 트리에서 contracts 파일을 먼저 고치고 양쪽이 따른다
  (mock 데이터도 함께 갱신 — data-model §6 "계약의 실행 가능한 사본")
