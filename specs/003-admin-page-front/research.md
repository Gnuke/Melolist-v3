# Research: 관리자 어드민 페이지 — 프론트엔드

**Date**: 2026-07-22 · **Spec**: [spec.md](./spec.md)

Technical Context의 미지수와 기술 선택을 결정한다. 각 항목: Decision / Rationale /
Alternatives considered.

---

## R1. 어드민 통합 방식 — 동일 SPA 내 lazy 라우트

**Decision**: 기존 React SPA에 `/admin/*` 라우트 세그먼트를 추가하되, React Router의
lazy 로딩으로 **어드민 번들을 분리**한다. 별도 앱·별도 배포는 하지 않는다.

**Rationale**:
- 배포 파이프라인(Vercel) 변경 0, 인증(Supabase 세션·Axios 인터셉터)·디자인 토큰·
  shadcn 컴포넌트를 그대로 재사용한다.
- lazy chunk 분리로 일반 사용자의 초기 번들 크기 영향이 없다(SC-005의 "기존 화면
  회귀 0"에 기여).
- Clarifications에서 "URL 직접 접근만"으로 확정 — 별도 주소 체계가 필요 없다.

**Alternatives considered**:
- 별도 앱(서브도메인 분리 배포): 완전 격리는 좋으나 배포·인증 연동 비용이 v1 범위 초과
  (spec Q1에서 기각).
- eager 라우트(코드 스플리팅 없음): 구현 단순하나 사용자 번들에 어드민 코드가 섞임 — 기각.

## R2. 어드민 데이터 조회 — 단일 지표 엔드포인트

**Decision**: 대시보드(US1)는 **단일 요청** `GET /api/admin/metrics?days=N`으로 KR2·
구간 분해·KR3·실패 분포·주간 추이·현황 요약을 한 번에 받는다. 카탈로그·사용자는
표준 PageResponse 목록 + PATCH 수정으로 구성한다(계약: [contracts/admin-api.md](./contracts/admin-api.md)).

**Rationale**:
- 운영 백엔드(Render 무료)는 콜드스타트가 수십 초다 — 요청 횟수가 곧 대기 시간.
  대시보드 한 화면이 5개 엔드포인트를 순차 워밍업하는 것보다 1회 왕복이 낫다.
- 집계 정의는 `backend/db/queries/kr_metrics.sql`이 정본(스펙 Assumption) — 백엔드가
  같은 정의로 집계해 반환하면 프론트는 표시만 한다(집계 로직 중복 없음).
- 서버 아는 것은 서버가 계산한다는 기존 역할 경계(frontend-prd §1)와 정합.

**Alternatives considered**:
- 지표별 분리 엔드포인트(5종): REST 관점상 깔끔하나 콜드스타트 환경에서 불리 — 기각.
- 프론트가 event_log 원시 데이터를 받아 직접 집계: 산식 이중화(정본 위반) + 대량 전송 — 기각.

## R3. 차트 — 신규 라이브러리 도입하지 않음

**Decision**: 주간 추이·실패 분포·구간 분해는 **표 + CSS/SVG 바(bar)** 조합으로
직접 렌더한다. 차트 라이브러리(recharts 등)를 추가하지 않는다.

**Rationale**:
- constitution "기술 스택 제약"은 확정 목록이며 변경은 개정 절차가 필요하다. 신규
  의존성 추가를 피하는 것이 가장 안전하다.
- 어드민 v1의 시각화 수요는 낮다(1인 관리자, 수치 확인 목적). p95·완료율은 스탯 타일,
  분포·추이는 수평 바 리스트로 충분하다.
- 기존 화면들(즐겨찾기·기록)도 목록 패턴 중심 — 시각 언어 정합.

**Alternatives considered**:
- recharts/visx 도입: 표현력은 높으나 의존성 추가 + constitution 개정 논의 필요 — v1 기각.

## R4. 시뮬레이션(mock) 모드 — 기존 searchMock 패턴 계승

**Decision**: `frontend/src/mock/adminMock.ts`를 신설하고 기존 `searchMock.ts` 패턴을
그대로 따른다: 모듈 상수 토글(`MOCK_ADMIN_ENABLED`) + `import.meta.env.DEV` 가드 +
동적 import(프로덕션 번들 제외) + "mock 비활성 시 null 반환 → 실제 API 진행".

**Rationale**:
- FR-009/SC-004(백엔드 없이 전 화면 시연)의 직접 구현 수단이며, 프로젝트에 이미
  확립된 관례라 학습 비용 0.
- 백엔드가 별도 트리에서 병렬 구현되는 동안 프론트를 독립 완성·검증할 수 있다.
- mock 데이터는 계약 문서의 예시 응답과 동일하게 유지 — mock이 곧 계약의 실행 가능한
  사본이 된다.

**Alternatives considered**:
- MSW(Mock Service Worker): 네트워크 계층 목킹은 충실하나 신규 의존성 — 기각(R3와 동일 논리).
- Vite proxy + json-server: 별도 프로세스 필요, 1인 개발 마찰 — 기각.

## R5. 접근 가드 — useMe의 role 재사용 (백엔드 변경 불필요)

**Decision**: 어드민 가드는 기존 `useMe()`(GET /api/users/me)의 `role` 필드로 판정한다.
비로그인·비관리자는 홈(`/`)으로 조용히 리다이렉트한다(어드민 존재 비노출). 최종 권한
강제는 백엔드 `/api/admin/*` 전 엔드포인트의 관리자 검사(401/403)가 담당한다.

**Rationale**:
- `Profile` 타입에 `role: string`이 **이미 존재**(ProfileResponse 계약, M1) — 프론트
  가드에 백엔드 변경이 필요 없다. profiles.role 컬럼도 기존 스키마에 있다(기본 'USER').
- 화면 가드는 UX 장치일 뿐이라는 스펙 Assumption과 일치 — 데이터 보호는 서버 403이 담당.
- 홈 리다이렉트는 로그인 화면 유도보다 존재 비노출에 유리(비관리자에게 "관리자 로그인"
  힌트를 주지 않음).

**Alternatives considered**:
- JWT 클레임(app_metadata)에 role 탑재: Supabase 커스텀 클레임 설정 필요 + 토큰 갱신
  주기 문제 — 기존 DB role 조회로 충분해 기각.
- 404 페이지 위장: 구현 복잡도 대비 이득 미미(리다이렉트로 충분) — 기각.

## R6. visit 오염 방지 — trackVisitOnce에 어드민 경로 가드

**Decision**: `trackVisitOnce()`(features/events/track.ts)에 "현재 경로가 `/admin`으로
시작하면 발화·마킹 모두 생략" 가드를 추가한다(2줄). 어드민 영역의 화면·기능은 어떤
계측 이벤트도 발화하지 않는다.

**Rationale**:
- FR-012/SC-006의 직접 구현. `visit`은 앱 로드 시 main.tsx에서 무조건 발화되므로
  `/admin` 직접 진입이 KR3 분모를 오염시킨다 — 발화 지점 가드가 유일한 차단점.
- visited 마킹까지 생략해야 함: 관리자가 이후 일반 화면으로 이동해 실사용할 경우의
  방문은 정상 사용이므로 억제하면 안 된다(단, SPA 특성상 로드 없이는 재발화 없음 —
  허용 가능한 근사).
- 이 변경이 본 기능의 **유일한 기존 공유 파일 수정**(track.ts 가드 + router.tsx 라우트
  1블록)이다 — 충돌 표면 최소화 목표 달성.

**Alternatives considered**:
- main.tsx에서 조건 분기: 동일 효과지만 발화 규칙이 track 모듈 밖으로 새어나감 — track.ts
  내 응집 유지가 낫다.
- 서버에서 admin 세션 필터링: 세션을 admin으로 식별할 방법이 없음(이벤트 미발화가 정공법).

## R7. 표기 규약 — admin 계약은 snake_case, 검증 규칙 명문화

**Decision**: 어드민 API의 목록·지표 응답은 기존 목록 계약과 동일한 **snake_case**
(PageResponse: `items/page/size/total_items/total_pages`)를 따른다. 곡 수정 입력 검증:
영상 식별자 `^[A-Za-z0-9_-]{11}$`, 커버는 http(s) URL 문자열, 제목은 비어 있을 수 없음.

**Rationale**:
- 검색·즐겨찾기·기록 등 M2 이후 계약이 snake_case로 정착(user 도메인만 M1 camelCase
  잔존) — 신규 admin 도메인은 다수 관례를 따른다.
- 영상 식별자 11자 규칙은 기존 ytimg 폴백 체인(`i.ytimg.com/vi/{id}`)이 전제하는 형식.
- 검증 실패는 표준 에러 바디 `{code, message, details}` + 400 — FR-010(정제 카피)과 연결.

**Alternatives considered**:
- user 도메인처럼 camelCase: 도메인 간 혼재를 늘림 — 기각.

## R8. 테스트·게이트 — 기존 프론트 게이트 유지

**Decision**: 신규 테스트 프레임워크를 도입하지 않는다. 게이트는 기존 관행대로
`tsc + vite build` + `oxlint` 통과 + quickstart의 mock 시나리오 수동 검증(SC 매핑)으로
한다.

**Rationale**:
- 프론트 저장소에는 현재 테스트 러너가 없다(M2 DoD도 build·oxlint + 수동 E2E).
  본 기능에서 도입하면 스펙 범위(어드민)를 넘는 인프라 변경이 된다.
- mock 시나리오(빈 데이터·오류·권한 없음 포함)가 스펙의 엣지 케이스를 실행 가능한
  체크리스트로 커버한다.

**Alternatives considered**:
- vitest 도입: 가치는 있으나 별도 chore 스펙으로 다루는 것이 옳다 — 범위 밖.
