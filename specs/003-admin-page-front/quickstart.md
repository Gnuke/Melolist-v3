# Quickstart: 관리자 어드민 페이지 — 프론트엔드 검증 가이드

**Spec**: [spec.md](./spec.md) · **Contract**: [contracts/admin-api.md](./contracts/admin-api.md) · **Data model**: [data-model.md](./data-model.md)

## 전제

- Node 20+, `frontend/` 의존성 설치: `cd frontend && npm install`
- 백엔드 **불필요** — 아래 A는 전부 mock으로 검증한다(FR-009/SC-004).
  실서버 검증(B)은 어드민 백 트리 병합 후에만 가능.

## A. Mock 모드 검증 (백엔드 없이 — 개발 중 기본)

```powershell
cd frontend
# 1) mock 켜기: src/mock/adminMock.ts 의 MOCK_ADMIN_ENABLED = true 로 변경
npm run dev
```

브라우저에서 `http://localhost:5173/admin` 직접 입력(앱 내 진입점 없음 — 정상).

| # | 시나리오 | 방법 | 기대 결과 | 근거 |
|---|---|---|---|---|
| 1 | 가드 — 게스트 차단 | 비로그인으로 `/admin` 진입 | 어드민 노출 없이 홈으로 이동 | FR-001, SC-002 |
| 2 | 가드 — 일반 사용자 차단 | mock me의 role='USER'로 진입 | 홈으로 이동(존재 비노출) | FR-001, SC-002 |
| 3 | 대시보드 렌더 | role='ADMIN' + `normal` 시나리오 | KR2 모드별 p95·pass, KR3 완료율·목표 대비, 구간 분해, 실패 분포, 주간 추이, 현황 요약 표시 | FR-003~005, SC-001 |
| 4 | 기간 변경 | 기간 셀렉터 7→30일 변경 | 지표 재조회·갱신 | FR-004 |
| 5 | 분모 0 | `empty` 시나리오 | "데이터 없음" 상태(오류 아님) | 엣지 케이스 |
| 6 | 오류·재시도 | `error` 시나리오 | 정제 카피 + 재시도 버튼, raw 메시지 없음 | FR-010 |
| 7 | 로딩(콜드스타트) | `slow` 시나리오 | 로딩 상태 표시 | 엣지 케이스 |
| 8 | 곡 목록·검색·필터 | 카탈로그 탭에서 검색어·"영상 없음"·"커버 없음" 필터 | 목록·페이지네이션·필터 동작 | FR-006 |
| 9 | 곡 수정 | 곡 선택 → videoId 입력 → 저장 | 검증 통과 시 반영+피드백, `abc`(11자 미달) 입력 시 저장 거부+사유 | FR-007, SC-003 |
| 10 | 사용자 목록·역할 | 사용자 탭에서 role 변경 | 반영 확인. **자기 자신 ADMIN 해제는 비활성** | FR-008 |
| 11 | 이벤트 미발화 | 개발자도구 Network에서 `/admin` 이용 전 구간 확인 | `POST /api/events` 요청 0건 | FR-012, SC-006 |
| 12 | 기존 화면 무영향 | `/`(홈) 진입 | visit 정상 발화·검색 플로우 정상, 어드민 진입점 미노출 | FR-002, SC-005 |

## B. 실서버 검증 (어드민 백 트리 병합 후)

```powershell
# mock 끄기: MOCK_ADMIN_ENABLED = false
# 백엔드 로컬 기동(기존 절차) 후:
cd frontend && npm run dev
```

1. Supabase SQL Editor에서 본인 계정 승격: `update profiles set role='ADMIN' where email='<본인>';`
   (최초 관리자 부트스트랩 — 스펙 Assumption)
2. A-3~A-10을 실데이터로 재확인. 대시보드 수치는 `backend/db/queries/kr_metrics.sql`
   수동 실행 결과와 **일치**해야 한다(산식 정본 검증).
3. 비관리자 계정 JWT로 `GET /api/admin/metrics` 직접 호출 → 403 표준 바디 확인(계약 §0).

## C. 게이트 (병합 전 최소 — constitution 원칙 VI)

```powershell
cd frontend
npm run build   # tsc + vite build
npm run lint    # oxlint
```

- 빌드·린트 통과 + A 시나리오 전체 통과 = 프론트 DoD.
- 프로덕션 번들에 adminMock 미포함 확인(기존 searchMock과 동일한 DEV 가드 + 동적 import 패턴).
- 사용자 초기 번들에 어드민 청크 미포함 확인(`npm run build` 출력의 청크 분리 확인).
