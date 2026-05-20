# 🎤 Dev 개요

교육 간 제출용 프로젝트

-------

## 💿 실행방법

#### 1. 프로젝트 클론
- git clone

- cd Melolist

#### 2. Nuxt 애플리케이션 디렉토리로 이동
- cd nuxt-app

#### 3. 의존성 설치
- npm install

#### 4. 개발 서버 실행
- npm run dev

--------

# 🤝 Branch & PR 정책

### 브랜치 구조

- `main`: 운영(배포) / 최종 릴리즈 브랜치
- `dev`: 통합 브랜치
- `feature/*`: 개인 작업 브랜치

###  협업 규칙

- `main`: 배포/제출용 안정 브랜치 (직접 push 금지, PR로만 병합)
- `dev`: 팀 개발 브랜치
- 기능 단위 개발 시 개인 브랜치(`feature/*`) 생성 권장
- 개인 브랜치(`feature/*`)에서 작업 후 `dev`로 PR을 생성하고, PR의 Preview URL로 기능을 확인

### 작업 흐름

1. `dev` 브랜치에서 기능 브랜치를 생성합니다.
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-task

2. 기능 브랜치에서 작업 후 변경사항을 push 합니다.

3. Pull Request를 생성합니다: feature/* → dev

4. Squash 방식으로 병합(Merge)합니다.

--------

### 🏃 참여자

- 정진욱
- 진기성
- 김은혜
- 금규환
- 이원우
  
--------

### 📌 프로젝트 목적

- 교육 간 학습한 **Vue** 와 **Nuxt.js** 숙달
- **데이터 설계 → 인증(OAuth) → API → 배포**까지 전 과정을 경험
- ORM(Prisma)과 MariaDB를 활용한 **관계형 데이터 모델링 및 CRUD 구현**

--------

### 🛠️ 기술 스택(Nuxt.js 마이그레이션 완료)                            

| 구분 | 기술/라이브러리 | 버전 | 설명 |
|---|---|---:|---|
| **Framework** | Nuxt | ^4.2.2 | Vue 기반 풀스택 프레임워크(SSR/CSR, 파일 기반 라우팅, Nitro 서버) |
| **UI** | Vue | ^3.5.26 | 컴포넌트 기반 UI |
| **Routing** | vue-router | ^4.6.4 | (참고) Nuxt 라우팅의 내부 기반 |
| **Audio** | wavesurfer.js | ^7.12.1 | 오디오 파형 시각화/재생 |
| **Icons** | @fortawesome/fontawesome-free | ^6.7.2 | 아이콘 폰트 |
| **Server Utils** | form-data | ^4.0.5 | 서버에서 multipart/form-data 구성(ACRCloud 요청용) |
| **Dev** | @types/node | ^25.0.9 | Node 타입(IDE/TS 지원) |
| **DB**   | MariaDB       |    ^12.1.2    | User data, 평가 data 저장                                          |
| **API**| AcrCloud API       | -  | 음악 Fingerprint 및 Humming 기반 검색 기능 제공, Youtube Metadata API 연동                              |

-------

### 📋 주요 기능

#### 1) 회원/인증
- **비회원도 검색 및 서비스 이용 가능**
- 단, **평가(Board) 작성/수정/삭제는 로그인 필요**
- 인증 방식: **OAuth2 (Google, Naver)**
- 회원가입 정책:
  - 별도 가입 폼 없이 **OAuth 로그인 성공 시 member 레코드 자동 생성(Just-in-time 가입)**

#### 2) 서비스 평가(Board)
- 앱/서비스 전반에 대한 평가 기능 제공
- CRUD:
  - Create/Update/Delete: 로그인 사용자만 가능
  - Read: 비회원도 가능(선택)
- 평가 데이터는 `board` 테이블에 저장, 작성자(`member`)와 연관

#### 3) 평가 유도 UX
- 비회원에게도 “서비스 평가 참여” UI를 노출하여 **로그인 유도**
- “나중에” 선택 시 일정 기간 동안 평가 UI 미노출
  - 비회원: 쿠키/LocalStorage로 제어
  - 회원: DB에 상태 저장

---

### 🗄️ 데이터 구조(요약)

#### member (회원)
- OAuth 로그인 시 자동 생성
- 사용자 식별 및 평가 작성자 관리

#### board (서비스 평가)
- 앱/서비스에 대한 평가 게시판
- 작성자(member)와 연관, CRUD 지원

----

### 🔐 권한 정책

| 기능 | 비회원 | 로그인 |
|------|--------|--------|
음악 검색 / 결과 조회 | ✅ | ✅ |
평가(Board) 조회 | ✅ | ✅ |
평가(Board) 작성 | ❌ | ✅ |
평가 수정/삭제 | ❌ | 작성자만 |

---

### 🚀 배포 및 운영

- Nuxt 단일 애플리케이션 구조로 배포
- 외부 API 키 및 보안 정보는 **환경변수(Vercel Environment Variables)** 로 관리
- 로컬 개발: `.env` 사용 / 운영 환경: Vercel env 사용

---

### 📁 프로젝트 디렉토리 구조

```

Melolist
├─ LICENSE
├─ nuxt-app
│  ├─ app
│  │  ├─ app.vue
│  │  ├─ components
│  │  ├─ composables
│  │  │  ├─ useAuthTest.js
│  │  │  └─ useMusicSearch.ts
│  │  ├─ layouts
│  │  │  ├─ centered.vue
│  │  │  └─ default.vue
│  │  ├─ pages
│  │  │  ├─ auth
│  │  │  ├─ boards
│  │  │  └─ index.vue
│  │  └─ utils
│  ├─ docs
│  │  └─ plantuml
│  ├─ mocks
│  │  └─ db
│  ├─ nuxt.config.ts
│  ├─ prisma
│  ├─ server
│  │  ├─ api
│  │  │  ├─ auth
│  │  │  ├─ boards
│  │  │  ├─ fingerprints.post.ts
│  │  │  └─ humming.post.ts
│  │  ├─ plugins
│  │  │  └─ prisma.ts
│  │  ├─ services
│  │  │  └─ musicsearch
│  │  └─ utils
│  │     ├─ db.js
│  │     └─ prisma.ts
│  └─ tsconfig.json
└─ README.md

```
