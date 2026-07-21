# 🎵 Melolist

**허밍이나 주변 음악 녹음만으로 노래를 찾는 음악 검색 서비스** — 찾은 곡은 즐겨찾기·플레이리스트로 저장하고, 검색 기록으로 다시 만납니다.

기존 Nuxt 앱(v2)을 **React + Spring Boot(Java 21 LTS) + Supabase**로 재플랫폼한 v3 프로젝트입니다.
v2는 5인 팀 프로젝트였고, **v3 재플랫폼은 1인 개발** — 설계·구현·리뷰 전 과정을 **Claude Code(AI 에이전트)** 와 협업해 진행합니다.

| | |
|---|---|
| 🌐 Frontend | [melolist-v3.vercel.app](https://melolist-v3.vercel.app) (Vercel) |
| ⚙️ Backend | [melolist-v3.onrender.com](https://melolist-v3.onrender.com) (Render 무료 티어 — 15분 유휴 시 슬립, 콜드스타트 30초+ 유의) |

---

## ✨ 주요 기능

#### 🔍 음악 검색 (게스트 포함 누구나)
- **지문(Fingerprint) 검색**: 주변에서 흐르는 음악을 녹음해 인식
- **허밍(Humming) 검색**: 직접 흥얼거린 멜로디로 인식 — ACRCloud 기반, Top-3 결과 + 매칭률 표시
- 결과 화면: 커버 아트·유튜브 링크·미리듣기(wavesurfer 파형), 검색 중 취소 확인 시트(녹음 일시정지/재개)
- 응답 최적화: 저장·기록은 비동기 후처리로 분리 — **허밍 p95 5.7s** (최적화 전 12.4s)

#### 👤 계정 (Google OAuth2 — Supabase Auth)
- 별도 가입 없이 **로그인 성공 시 프로필 자동 생성(JIT 프로비저닝)**
- 검색 결과 화면에서 로그인해도 **하던 맥락 그대로 복귀** (결과 화면 복원)
- 프로필 관리: 별명 수정 + 아바타 업로드(클라 크롭 → Supabase Storage)

#### 💾 저장 & 탐색 (로그인)
- **즐겨찾기 ♡**: 검색 결과·기록에서 토글, `/favorites` 목록
- **검색 기록**: 조회·삭제 + 기록에서 ♡ 토글·플레이리스트 담기
- **플레이리스트**: 생성·수정·삭제, 담기 시트(새로 만들고 바로 담기), 순서 편집, 공개/비공개(공개는 게스트도 조회)
- **Bottom Navigation 4탭**: 홈 · 즐겨찾기 · 플레이리스트 · 기록

#### 📊 측정 기본 탑재
- 전 화면 이벤트 계측(`event_log`) + KR 지표 산출 SQL(`backend/db/queries/kr_metrics.sql`) + 매칭률 측정 스크립트(`backend/scripts/match-rate/`)

---

## 🛠️ 기술 스택

### Frontend (`frontend/`)

| 구분 | 기술 | 비고 |
|---|---|---|
| Core | React 19 · TypeScript · Vite 8 | SPA, react-router 7 |
| 상태/데이터 | TanStack Query 5 · Zustand · axios | 서버 상태 캐싱, 인증 스토어 |
| UI | Tailwind CSS 4 · Radix UI · lucide-react · motion | 자체 디자인 시스템(Flame/Iris 팔레트 + Pretendard) |
| Audio | wavesurfer.js 7 | 녹음 파형·재생 |
| Auth | @supabase/supabase-js | Google OAuth → JWT |
| Lint | oxlint | |

### Backend (`backend/`)

| 구분 | 기술 | 비고 |
|---|---|---|
| Runtime | **Java 21 (LTS)** · Spring Boot 3.5 · Gradle | 도메인 중심 패키지 구조 |
| Security | Spring Security | Supabase JWT(JWKS) Resource Server 검증 |
| ORM/DB | Spring Data JPA · Supabase PostgreSQL | 테스트는 H2, Hikari 풀 상한 5(무료 pooler 한도 대응) |
| 외부 API | ACRCloud (identify + Metadata) | 지문·허밍 인식, 커버·유튜브 링크 보강 |
| 테스트 | JUnit · Mockito + **acr-mock 프로파일** | ACRCloud 실호출 없이 전 파이프라인 E2E 가능 |

### Infra

- **Supabase** — PostgreSQL · Auth(Google OAuth) · Storage(아바타)
- **Vercel**(프론트) · **Render**(백엔드 Docker) — GitHub 연동 자동 배포, CI는 backend/frontend 경로 분리

---

## 💿 실행 방법

### Backend

```bash
cd backend
cp .env.example .env      # Supabase·ACRCloud 키 입력 (커밋 금지)
./gradlew bootRun          # http://localhost:8080
```

- JDK 21이 없어도 Gradle toolchain이 자동 프로비저닝합니다.
- ACRCloud 키 없이 파이프라인을 확인하려면 **acr-mock 프로파일**: `SPRING_PROFILES_ACTIVE=acr-mock` (+ `ACR_MOCK_SCENARIO=hit|nomatch|lowscore|error`)
- 상세: [backend/README](backend/README.md)

### Frontend

```bash
cd frontend
cp .env.example .env.local  # Supabase URL/anon key, API 주소
npm install
npm run dev                 # http://localhost:5173
```

---

## 📁 프로젝트 구조

```
Melolist-v3
├─ backend/          # Spring Boot — 도메인 MVC (auth·user·music·search·playlist·community·event)
│  ├─ db/            # 마이그레이션 SQL 사본 · KR 지표 쿼리
│  └─ scripts/       # 매칭률 측정 스크립트 (match-rate)
├─ frontend/         # React SPA — 검색·즐겨찾기·플레이리스트·기록·프로필
├─ docs/             # backend-prd · frontend-prd · design-guideline · devlog · git-strategy
├─ specs/            # spec-kit 명세 (001 Google OAuth2 로그인 등)
├─ .specify/         # spec-kit constitution(원칙 6종) · 템플릿
└─ nuxt-app/         # v2(Nuxt) — 레퍼런스로 보존
```

---

## 🤝 개발 방식

- **1인 개발 + AI 에이전트 협업**: 설계·구현·리뷰·운영 진단 전 과정을 **Claude Code**와 페어로 진행 — spec 명세와 [devlog](docs/devlog.md)로 세션 간 컨텍스트를 유지
- **Spec-Driven Development**: [spec-kit](https://github.com/github/spec-kit) — constitution(도메인 중심 아키텍처 / 계약 동기화 / 측정 기본 탑재 / 프라이버시·저작권 가드레일 / 게스트 우선 / mock 테스트 가능성) 기반으로 기능별 spec 작성 후 구현
- **브랜치**: GitHub Flow 단순화 — `main` 단일 + 기능별 `feat/*`·`fix/*`·`chore/*` 브랜치 → PR → CI 통과 후 병합 (상세: [docs/git-strategy.md](docs/git-strategy.md))
- **문서 위계**: [PRD.md](PRD.md)(제품 요구사항) → [docs/backend-prd.md](docs/backend-prd.md)·[docs/frontend-prd.md](docs/frontend-prd.md)(실행 PRD) → [docs/devlog.md](docs/devlog.md)(개발 일지)

---

## 📜 v2 (Nuxt) — 레거시

교육 과정 제출용으로 진행한 **5인 팀 프로젝트**입니다. Nuxt 4 + Prisma + MariaDB 구성이며, `nuxt-app/`에 레퍼런스로 보존되어 있습니다. (v3 재플랫폼은 위 명시대로 1인 개발로 별도 진행)

- 실행: `cd nuxt-app && npm install && npm run dev`
- v2 참여자: 정진욱 · 진기성 · 김은혜 · 금규환 · 이원우
