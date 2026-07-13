<!--
Sync Impact Report
- Version change: (템플릿, 미제정) → 1.0.0 (최초 제정)
- Modified principles: 없음 (신규 제정 — 원칙 6개 신설)
- Added sections:
  - Core Principles: I. 도메인 중심 아키텍처 / II. 계약 우선·문서 위계 /
    III. 측정 가능성 기본 탑재 / IV. 프라이버시·저작권 가드레일 /
    V. 게스트 우선 접근 / VI. 외부 의존 없는 테스트 가능성
  - 기술 스택 제약 (Section 2)
  - 개발 워크플로 (Section 3)
  - Governance
- Removed sections: 없음
- Templates:
  - ✅ .specify/templates/plan-template.md — Constitution Check 게이트가 본 파일을 동적 참조(수정 불필요)
  - ✅ .specify/templates/spec-template.md — constitution 참조 없음(수정 불필요)
  - ✅ .specify/templates/tasks-template.md — constitution 참조 없음(수정 불필요)
  - ✅ .specify/templates/checklist-template.md — constitution 참조 없음(수정 불필요)
- Follow-up TODOs: 없음
- 근거 문서: docs/PRD.md(마스터 v0.1) · docs/backend-prd.md(v1.0) ·
  docs/frontend-prd.md · docs/git-strategy.md · PRD 부록 A(2026-07-04 확정)
-->

# Melolist-v3 Constitution

## Core Principles

### I. 도메인 중심 아키텍처 (Domain-Centric Architecture)

백엔드는 계층(Layered)이 아닌 **도메인 중심 패키지 구조**를 유지한다
(`com.melolist` 아래 auth·user·music·search·playlist·community·recommendation·common).

- 모든 API는 **DTO 계약**으로만 노출한다. JPA Entity를 API 응답에 직접 노출하는 것을 금지한다.
- 에러 응답은 표준 바디 `{code, message, details}`를 사용해야 한다(MUST).
- 인가는 **앱 계층 단독**으로 수행한다(`@PreAuthorize` + 소유자 체크).
  DB RLS는 Supabase Storage 버킷에만 적용한다(부록 A-2 확정).
- 데이터 접근 계층은 Spring Data JPA로 **단일화**한다. v2의 ORM+raw SQL 이중화 회귀를 금지한다.

**근거:** 기능 추가 시 영향 범위 최소화(PRD §2.3). 도메인 경계가 곧 마일스톤(M2~M5) 경계다.

### II. 계약 우선·문서 위계 (Contract-First & Document Hierarchy)

프론트엔드와 백엔드는 **명시된 계약**으로만 통신한다.

- API 계약·이벤트 사전·에러 바디는 `backend-prd.md` §6.1과 `frontend-prd.md` §8이
  **동일해야 하며**, 한쪽 변경 시 양쪽을 같은 PR에서 함께 갱신해야 한다(MUST).
- 문서 위계: `PRD.md`(제품 총괄 마스터) → `backend-prd.md`/`frontend-prd.md`(실행 PRD).
  충돌 시 실행 PRD(최신 결정 반영)가 우선한다.
- API와 화면을 함께 바꾸는 기능은 **한 브랜치·한 PR**로 진행한다 — 모노레포 유지의 이유.

**근거:** 1인 개발에서 계약 불일치는 발견이 늦다. 문서 동기화 규칙이 통합 테스트를 대신하는
1차 방어선이다.

### III. 측정 가능성 기본 탑재 (Measurement by Default)

기능은 **측정 가능한 상태로만** 출고한다. Q3 OKR(KR1 매칭률·KR2 p95 응답시간·KR3 검색
완료율)이 기준이다.

- 검색 요청마다 구간별 타이밍 레코드(`total_ms/acr_ms/meta_ms/upsert_ms/audio_bytes/mode/matched`)
  기록을 의무화한다(C5).
- 사용자 행동은 `event_log`(`POST /api/events`)로 수집하고, KR 지표는 SQL로 산출 가능해야 한다.
- 신규 기능은 관련 지표 계측(이벤트·타이밍)을 **같은 마일스톤 안에서** 함께 구현한다.
  "측정은 나중에"를 금지한다.

**근거:** KPI 측정 도구 확정은 M6이지만, 원천 데이터는 소급 수집이 불가능하다(C2 결정).

### IV. 프라이버시·저작권 가드레일 (NON-NEGOTIABLE)

- 녹음 오디오 원본은 **저장하지 않는다**. 인식 후 즉시 폐기하며 `audio_path`는 항상 null이다
  (부록 A 확정).
- ACRCloud API 키·서명은 **서버에만 존재**한다. 시크릿은 환경변수(.env, 미추적)로만 관리하고
  커밋을 금지한다.
- 커버·썸네일 이미지는 **프록시·다운로드·재호스팅하지 않는다**. 핫링크 URL 문자열만 저장한다.
  Apple preview는 사용·저장 모두 금지한다(C8).

**근거:** 법적 리스크(저작권·개인정보)는 사후 수정이 불가능한 영역이다. 이 원칙 위반은 어떤
기능 가치로도 정당화되지 않는다.

### V. 게스트 우선 접근 (Guest-First Access)

- 핵심 기능(음악 검색·결과 조회)은 **비로그인으로 즉시** 사용 가능해야 한다.
  저장(플레이리스트·즐겨찾기)·공유·리뷰 작성은 로그인을 요구한다.
- 리뷰는 곡이 아닌 **서비스에 대한 평가**이며 **1인 1리뷰**를 유지한다
  (user_id unique 제약, 중복 작성 시 409).
- 인증은 Supabase Auth(JWT)에 위임한다. 백엔드는 JWKS로 **검증만** 수행하고,
  최초 접근 시 `profiles`를 JIT 프로비저닝한다. 자체 로그인 플로우 구현을 금지한다.

**근거:** OKR의 O — "처음 방문한 게스트가 30초 안에 흥얼거린 곡을 찾아내는 경험."
가입 장벽은 이 목표의 최대 적이다.

### VI. 외부 의존 없는 테스트 가능성 (Testability Without External Calls)

- 외부 API 연동(ACRCloud 등)은 **mock 프로파일**을 함께 제공해야 한다
  (예: `acr-mock` 프로파일 + `ACR_MOCK_SCENARIO` 시나리오 4종).
  실호출 없이 파이프라인 전체를 E2E로 검증 가능해야 한다.
- `main`은 항상 빌드·기동 가능한 상태를 유지한다. 병합 전 최소 게이트:
  빌드 성공 + 설정 validate + mock 기반 E2E 통과.
- 실 외부 호출 검증(실오디오 지문/허밍)은 별도 수동 스크립트(C6 매칭률 측정)로 수행하며
  CI에 포함하지 않는다.

**근거:** ACRCloud는 호출량 과금·비결정적 응답 특성이 있어 CI에 부적합하다.
mock 경계가 없으면 회귀 검증 비용이 기능 추가를 막는다.

## 기술 스택 제약

아래 스택은 **확정 사항**이며, 변경은 constitution 개정(Governance 절차)으로만 가능하다.

- **Backend:** Java 21(LTS) · Spring Boot 3.5 · Spring Security(JWKS Resource Server) ·
  Spring Data JPA(단일 데이터 접근) · Lombok · Bean Validation
- **Frontend:** React + TypeScript · React Router · TanStack Query(서버 상태) ·
  Zustand(클라이언트 UI 상태) · Axios(JWT 인터셉터) · Tailwind CSS v4 + 디자인 토큰 ·
  shadcn/ui(Radix) · Framer Motion · wavesurfer.js
- **Data/Infra:** Supabase(PostgreSQL·Auth·Storage) · ACRCloud(지문/허밍/메타데이터)
- **배포(MVP):** Vercel(frontend) + Render(backend, 무료 티어 콜드스타트 유의).
  Docker + AWS 전환은 M6에서 재검토한다.
- **데이터 정본 규칙:** MUSIC은 `youtube_video_id`(정본) + `cover_url`을 저장한다.
  `youtube_url`은 DTO에서 파생하고, `thumbnail_url`·`preview_url`은 저장을 금지한다(C1).

## 개발 워크플로

- **브랜치 모델:** GitHub Flow 단순화 — `main` + 작업 브랜치
  (`feat/*`·`fix/*`·`refactor/*`·`docs/*`·`chore/*`).
  기능 작업은 브랜치에서 수행하고 PR로 병합한다. `main`은 항상 동작 상태를 유지한다.
- **브랜치 네이밍:** `<type>/<milestone>-<topic>` (예: `feat/m2-acrcloud-search`),
  소문자 케밥 케이스. 마일스톤 단위 장수 브랜치 대신 **기능 단위로 잘게** 만들어 자주 병합한다.
- **커밋:** Conventional Commits + 영역 scope(`feat(backend):` / `feat(frontend):`).
- **모노레포 CI:** 워크플로를 backend/frontend로 분리하고 `paths:` 필터를 적용한다.
  문서만 변경 시 어떤 빌드도 실행되지 않아야 한다.
- **버전 태그:** 통합 마일스톤 태그(`v0.2.0` 등)를 기본으로 하고, 배포 주기가 분리되는
  시점부터 접두사 태그(`backend-v0.3.0`)로 전환한다.

## Governance

- 이 constitution은 프로젝트의 다른 관행·문서보다 **우선**한다. 단, 제품 요구사항의 상세는
  원칙 II의 문서 위계(PRD → 실행 PRD)를 따르며, constitution은 그 위계 규칙 자체를 정의한다.
- **개정 절차:** 개정은 커밋(또는 PR)으로 수행하며, 변경 내용 문서화 + 버전 증가 +
  Sync Impact Report 갱신을 포함해야 한다.
- **버전 정책(semver):**
  - MAJOR — 원칙 제거·재정의 등 하위 호환 파괴
  - MINOR — 원칙·섹션 추가 또는 실질적 지침 확장
  - PATCH — 문구 명확화·오타 등 비의미 변경
- **준수 검토:** 모든 PR은 constitution 준수를 확인한다. 특히 원칙 IV(가드레일)는
  예외 없이 적용하며, 그 외 원칙의 예외는 plan의 Complexity Tracking에 정당화 사유를
  기록해야 한다.
- **런타임 가이드:** 구현 세부 지침은 `docs/PRD.md`·`docs/backend-prd.md`·
  `docs/frontend-prd.md`·`docs/git-strategy.md`를 참조한다.

**Version**: 1.0.0 | **Ratified**: 2026-07-13 | **Last Amended**: 2026-07-13
