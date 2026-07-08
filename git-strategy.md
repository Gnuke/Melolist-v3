# Melolist-v3 Git 전략

> 원격 저장소: `https://github.com/Gnuke/Melolist-v3.git` (아직 미연결)
> 구성: 1인 개발 · 모노레포(`frontend/` React SPA, `backend/` Spring Boot, `PRD.md` 등 공통 문서) · `nuxt-app/`은 레거시 v2 참고용으로 git 추적 제외(.gitignore)
> 마일스톤: M1(기반) → M2(검색) → M3(저장) → M4(커뮤니티) → M5(AI) → M6(하드닝/운영 배포)

---

## 1. 브랜치 모델 — GitHub Flow (단순화)

1인 개발이므로 Git Flow(develop/release/hotfix 분리)는 과합니다.
**`main` + 작업 브랜치** 2단 구조를 사용합니다.

```
main ──●───────●──────────●────────▶  항상 동작하는 상태 유지, 태그의 기준점
        \     /            \
         feat/scaffold-m1   feat/m2-acrcloud-search
```

| 브랜치 | 역할 | 규칙 |
|---|---|---|
| `main` | 기준 브랜치. 항상 빌드·기동 가능한 상태 | 직접 커밋 금지, PR로만 병합 |
| `feat/*` | 기능 개발 | 작업 완료 후 PR → `main` |
| `fix/*` | 버그 수정 | 〃 |
| `refactor/*` | 동작 변경 없는 구조 개선 | 〃 |
| `docs/*` | 문서만 변경 | 〃 |
| `chore/*` | 빌드/설정/의존성 등 | 〃 |

### 브랜치 네이밍

```
<type>/<milestone>-<topic>     # 예: feat/m2-acrcloud-search
<type>/<topic>                 # 마일스톤과 무관한 작업. 예: fix/cors-preflight
```

- 소문자 케밥 케이스, 영문 사용
- 마일스톤 단위의 큰 브랜치 하나로 오래 끌지 말고, **기능 단위로 잘게** 만들어 자주 병합
  (예: M2는 `feat/m2-acrcloud-client`, `feat/m2-music-cache`, `feat/m2-search-ui`로 분할)
- 현재 진행 중인 `feat/scaffold-m1`은 그대로 유지하고, 이후부터 위 규칙 적용

## 2. 모노레포 운영 원칙 — backend/frontend 분리 관리

> 결정(2026-07-08): 저장소는 **하나(모노레포)로 유지**하되, backend/frontend의 CI/CD·이력·버전을 **영역별로 분리 운영**한다. 저장소 자체를 쪼개는 방식(polyrepo)은 협업자 증가·배포 주기 분리 등 실제 필요가 생길 때 재검토.

### CI/CD 분리 — 경로 필터

영역별 워크플로우를 나누고 `paths:` 필터로 해당 디렉터리 변경 시에만 실행합니다. 문서만 바뀌면 어떤 빌드도 돌지 않습니다.

```yaml
# .github/workflows/backend-ci.yml
on:
  pull_request:
    paths: ['backend/**']
  push:
    branches: [main]
    paths: ['backend/**']

# .github/workflows/frontend-ci.yml — paths: ['frontend/**'] 로 동일 구조
```

### 이력·작업 단위 분리

- 커밋 scope(`feat(backend):` / `feat(frontend):`)와 브랜치 이름으로 영역 구분 (3장 컨벤션)
- 한쪽 이력만 보기: `git log --oneline -- backend/`
- 단, API와 화면을 함께 바꾸는 기능은 **한 브랜치·한 PR**로 진행 — 이게 모노레포를 유지하는 이유

### 버전 분리 (필요 시)

- 기본은 통합 마일스톤 태그(5장, `v0.2.0` 등) 하나로 충분
- 배포 주기가 달라지는 시점부터 접두사 태그로 전환: `backend-v0.3.0`, `frontend-v0.3.1`

### 향후 저장소 분리 경로

polyrepo가 필요해지면 `git filter-repo --subdirectory-filter backend`로 **해당 디렉터리 이력만 보존한 새 저장소**를 언제든 만들 수 있습니다. 모노레포 → polyrepo는 쉬운 전환이므로 분리 결정을 서두를 이유가 없습니다.

## 3. 커밋 컨벤션 — Conventional Commits

이미 사용 중인 형식을 그대로 표준화합니다.

```
<type>(<scope>): <제목>

[본문 — 선택, 무엇을/왜]
```

- **type**: `feat` `fix` `refactor` `docs` `chore` `test` `perf` `style` `ci`
- **scope**(모노레포 구분용): `frontend` `backend` `docs` `infra` — 양쪽에 걸치면 생략 가능
- 제목은 명령형·마침표 없이, 한 커밋 = 하나의 논리적 변경

```
feat(backend): ACRCloud 지문 인식 클라이언트 추가
fix(frontend): 녹음 종료 시 MediaStream 트랙 해제 누락 수정
docs: M2 검색 API 명세 추가
```

## 4. PR & 병합 전략

1인 개발이어도 **PR을 통해 병합**합니다 — 셀프 리뷰 기회 + GitHub에 작업 단위 기록이 남고, 이전 프로젝트(v2)의 PR 흐름과도 일관됩니다.

| 항목 | 규칙 |
|---|---|
| 병합 방식 | **Squash merge** 기본 (main 히스토리를 PR 단위로 깔끔하게) |
| 예외 | 커밋 하나하나가 의미 있는 큰 브랜치(마일스톤 스캐폴딩 등)는 **Rebase and merge** |
| PR 제목 | 커밋 컨벤션과 동일 형식 (squash 시 그대로 main 커밋 메시지가 됨) |
| PR 본문 | 변경 요약 · 테스트/확인 방법 · 관련 마일스톤(M2 등) 명시 |
| 병합 후 | 작업 브랜치 즉시 삭제 (GitHub "Automatically delete head branches" 켜기) |
| main 최신화 | 작업 브랜치가 뒤처지면 `git rebase main` (merge로 당기지 않기 — 히스토리 단순 유지) |

GitHub 저장소 설정 권장값:
- Settings → General: **Squash merging만 허용** + Rebase merging 허용, Merge commit 비활성
- Settings → Branches: `main`에 branch protection (직접 push 방지 — 1인이라도 습관용)

## 5. 태그 & 릴리스 — 마일스톤 = 마이너 버전

| 시점 | 태그 | 비고 |
|---|---|---|
| M1 완료 | `v0.1.0` | 스캐폴딩 + Supabase 실기동 |
| M2 완료 | `v0.2.0` | 검색 E2E |
| M3 완료 | `v0.3.0` | 개인 라이브러리 |
| M4 완료 | `v0.4.0` | 커뮤니티 |
| M5 완료 | `v0.5.0` | AI 프로토타입 |
| M6 완료 (운영 배포) | `v1.0.0` | 이후 SemVer(`v1.0.1` 패치 등) |

```powershell
git tag -a v0.1.0 -m "M1: 기반 스캐폴딩 완료"
git push origin v0.1.0
```

태그는 항상 `main`의 병합 커밋에, annotated(`-a`)로 생성합니다.

## 6. 시크릿 관리 규칙

- `.env`, 키 파일은 **절대 커밋 금지** — 루트 `.gitignore`의 `.env` / `.env.*` 패턴이 전 디렉터리에 적용됨
- 커밋 전 `git status`로 스테이징 목록 확인, 새 설정 파일 추가 시 예시 파일(`.env.example`)만 커밋
- Supabase/ACRCloud 키는 로컬 `.env` + (배포 시) GitHub Actions Secrets로만 관리

## 7. 원격 연결 절차 (아직 실행하지 말 것)

### ⚠️ 사전 필수: 시크릿 이력 제거

현재 git 이력에 **`nuxt-app/.env`가 실제 키와 함께 커밋되어 있음** (ACRCloud API 키/시크릿, Google·Naver OAuth 시크릿, DB 접속 문자열). 원격 push 전에 반드시:

1. **이력에서 파일 제거** — 아직 원격이 없으므로 히스토리 재작성 부담이 없는 지금이 적기

   ```powershell
   pip install git-filter-repo
   git filter-repo --path nuxt-app/.env --invert-paths --force
   ```

   (filter-repo는 안전을 위해 remote 설정을 지우므로, 원격 연결 전에 실행하는 것이 순서상 자연스러움)

2. **노출된 키 전부 로테이션** — 이 이력은 이전(v2) 원격에도 존재했을 수 있으므로, 이력 제거와 무관하게 ACRCloud·Google·Naver·DB 키는 재발급 권장

3. `git log --all --oneline -- nuxt-app/.env` 결과가 비어 있는지 확인

### 연결 & 최초 push

```powershell
git remote add origin https://github.com/Gnuke/Melolist-v3.git
git push -u origin main
git push -u origin feat/scaffold-m1
```

이후 GitHub에서 4장의 저장소 설정(병합 방식, branch protection, 브랜치 자동 삭제) 적용.

## 8. 일상 워크플로우 요약

```powershell
# 1. 시작 — main 최신화 후 브랜치 생성
git switch main && git pull
git switch -c feat/m2-acrcloud-client

# 2. 작업 — 논리 단위로 커밋
git add <files>
git commit -m "feat(backend): ACRCloud 요청 서명 유틸 추가"

# 3. 공유 — push 후 PR 생성
git push -u origin feat/m2-acrcloud-client
gh pr create --fill

# 4. 병합 — 셀프 리뷰 후 Squash merge, 브랜치 삭제
gh pr merge --squash --delete-branch

# 5. 마일스톤 완료 시 태그
git switch main && git pull
git tag -a v0.2.0 -m "M2: 검색 E2E 완료" && git push origin v0.2.0
```

## 9. 당면 계획 (현 시점 기준)

1. `feat/scaffold-m1`에서 Supabase 키 발급 → 실기동 확인까지 마무리
2. 7장의 **시크릿 이력 제거 + 키 로테이션** 수행
3. 원격 연결, `main`·`feat/scaffold-m1` push
4. `feat/scaffold-m1` → `main` PR 생성, Rebase and merge (스캐폴딩 커밋들은 단위가 의미 있음)
5. `v0.1.0` 태그 → M2 시작 (`feat/m2-*` 브랜치 분할)
