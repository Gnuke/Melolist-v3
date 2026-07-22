# docs — 문서 색인

Melolist-v3의 공통 문서 트리. 문서는 **목적별 폴더**로 분류한다 — 코드에 붙는 문서(`backend/README.md`·`frontend/README.md`)와 기능 명세(`specs/`)는 각자 위치에 그대로 둔다.

## 문서 위계 — 뭐가 정본인가

1. **실행 PRD** — [`prd/backend-prd.md`](prd/backend-prd.md) · [`prd/frontend-prd.md`](prd/frontend-prd.md): 요구사항·API 계약·이벤트 사전의 **현행 정본**. 충돌 시 최우선.
2. **OKR** — [`prd/okr-2026q3.md`](prd/okr-2026q3.md): 분기 목표·KR 정의(2026-07-08 확정).
3. **기능 명세** — `specs/<번호>-<기능>/`(spec-kit): 기능 단위 상세. 일부 API는 specs 쪽 `contracts/`가 계약 정본이며, 그 경우 실행 PRD가 참조를 명시한다(예: admin).
4. **아카이브** — `archive/`: 스냅숏. **갱신하지 않는다.**

## 폴더별 목적과 규칙

| 폴더 | 목적 | 규칙 |
|---|---|---|
| [`prd/`](prd/) | 살아있는 요구사항·계약·OKR | 계약 변경은 backend·frontend 양쪽을 **같은 PR에서** 갱신 (constitution 원칙 II) |
| [`guides/`](guides/) | 작업 방식 규칙 — [디자인](guides/design-guideline.md) · [git 전략](guides/git-strategy.md) | 방식이 바뀌면 그때그때 갱신 |
| [`devlog/`](devlog/) | 개발 일지 | **월별 1파일**(`YYYY-MM.md`), 파일 안에서는 최신 항목이 위 |
| [`archive/`](archive/) | 더 이상 갱신하지 않는 역사 스냅숏 | 갱신 금지 — 파일 상단 배너로 현행 정본 위치를 안내 |

## 문서 작업 규칙 — 새로 쓸 때 어디에 두나

- **요구사항·API 계약 변경** → `prd/` 해당 문서 (specs `contracts/`가 정본인 영역은 그쪽 갱신 + 실행 PRD에 참조 반영)
- **새 기능 명세** → `specs/` (spec-kit 플로우)
- **작업 일지** → `devlog/YYYY-MM.md` (달이 바뀌면 새 파일)
- **작업 방식·규칙 문서** → `guides/`
- **수명이 끝난 문서** → 삭제하지 말고 `archive/`로 이동 + 상단에 아카이브 배너(날짜·현행 정본 위치)
- 문서를 이동·개명하면 참조를 함께 갱신한다: 루트 `README.md`, `backend/`·`frontend/` README, `.specify/memory/constitution.md`, `specs/` 내 경로 언급
