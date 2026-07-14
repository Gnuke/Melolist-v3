# Development Log

## 2026-07-14

### 완료

- **spec 001 잔여 구현 — 맥락 복귀(P2) + 로그아웃(P3) + 로그인 계측(FR-009)** (브랜치 `feat/google-oauth`)
  - **P2 맥락 복귀(FR-004)**: FavoriteSheet 로그인 유도 → `/login`에 `state.next`(현재 검색 화면 경로) 전달 → `signInWithOAuth`의 `redirectTo`를 `origin+next`로 — 로그인 후 홈이 아닌 시작 화면으로 복귀. 내부 경로(`/`로 시작)만 허용. (검색 결과 상태 소실 문제는 당일 후속 수정으로 해결 — 아래 "결과 화면 복원")
  - **P3 로그아웃(FR-008)**: `ProfileSheet` 신설(FavoriteSheet 패턴) — 홈 ProfileChip 클릭 → 시트(아바타·이름·이메일) → 로그아웃(`signOut` + `['me']` 쿼리 캐시 제거 + 토스트)
  - **FR-009 로그인 계측**: `login_started`/`login_succeeded`/`login_failed` 3종. OAuth는 전체 리다이렉트라 시작 시 sessionStorage pending 플래그 → 복귀 로드 시 `consumeLoginReturn()`이 성공(세션 확인)/실패(URL 에러 파라미터) 판정. 취소(access_denied)는 `reason=cancelled`로 구분(SC-002 분모 제외) + 안내 토스트 + 에러 파라미터만 URL에서 제거. 이미 로그인 상태로 `/login` 접근 시 리다이렉트(edge case)
  - **이벤트 사전 동기화(원칙 II)**: backend-prd §6.1 ↔ frontend-prd §7에 로그인 3종 동시 반영 + **기존 드리프트 정정** — 코드에만 있고 사전에 누락됐던 `favorite_click`(C6) 등재
  - **JIT avatar_url 수급(선택 항목)**: 백엔드 `UserService` — `user_metadata.avatar_url → picture` 순 추출, 프로비저닝 시 저장 + avatar 없이 만들어진 기존 행은 `/users/me` 호출 시 자가 치유(dirty checking)
- **로컬 E2E에서 발견된 결함 2건 수정** (같은 브랜치 후속 커밋)
  - 🐛 **로그인 계측 유실**: 첫 E2E에서 검색·♡ 이벤트는 적재되는데 로그인 3종만 0건. 원인 ① `login_started` — `track()`이 axios XHR이라 발화 직후 OAuth 전체 페이지 이동이 요청을 죽임 → **`fetch(keepalive: true)`로 교체**(페이지 이탈에도 전송 보장, Bearer는 authStore에서 동기 취득). 원인 ② `login_succeeded` — 복귀 직후 `getSession()` 단발 호출이 토큰 교환 완료 전이면 null → **authStore 구독으로 세션 등장 대기(최대 10초)** 후 발화(`waitForSession`)
  - 🐛 **FR-004 결과 화면 복원**: 로그인 후 `/search/{mode}` 경로로는 복귀하지만 결과가 리액트 상태라 소실 → 초기 녹음 화면이 뜸(US2 "처음부터 다시 시작" 금지 위반). → ♡ 시트에서 로그인 클릭 시 결과를 sessionStorage 스태시(`resultStash.ts`, mode·lowScore 포함, TTL 10분, 1회용)에 보관, 복귀 마운트 시 **OAuth 복귀 중일 때만**(pending 플래그로 판정) 결과 화면 복원. 복원 진입은 녹음 자동 시작·`search_result_shown` 재발화·최근 기록 중복 적재를 모두 건너뜀. 취소 복귀에도 동일 적용. 지문·허밍 공통(`SearchFlow` 공유)

### 검증

- 프론트 `tsc`·`oxlint`(기존과 동일 경고만)·`vite build` 통과, 백엔드 `gradlew build`(테스트 포함) 통과
- **로컬 실브라우저 E2E 전 항목 사용자 검증 통과**: 로그인/로그아웃(ProfileSheet) · ♡ 게스트 유도 → 로그인 → **결과 화면 그대로 복귀**(지문 확인, 허밍은 동일 코드 경로) · `event_log`에 `login_started`→`login_succeeded` 2쌍 적재 확인 · profiles `avatar_url` 자가 치유 확인(구글 프로필 사진). Supabase Redirect URLs 와일드카드 등록 완료(로컬분 동작 확인)
- ♡ 흐름 검증은 dev 전용 검색 목업(`MOCK_SEARCH_ENABLED`) + 무음 회피(마이크 마찰음)로 수행 — 공공장소에서 실음원 없이 테스트하는 우회로 확립

### 다음 작업

- PR → main 병합 → Vercel 재배포 → **운영 로그인 검증(SC-005)** (운영 와일드카드 `https://melolist-v3.vercel.app/**` 등록 상태 확인 포함)
- 이후: 실오디오 지문/허밍 검증(허밍 스파이크 §7.4) · 매칭률 스크립트(C6) = M2 DoD 완결 → M3 저장(즐겨찾기 실저장부터)

## 2026-07-13

### 완료

- **spec-kit(Spec-Driven Development) 도입** (커밋 `a65fdd1`, main)
  - `uv tool install specify-cli`(v0.12.11) → `specify init --here --integration claude --script ps`. `.specify/`(템플릿·스크립트) 커밋, `.claude/skills/speckit-*` 10종은 gitignore 유지
  - **constitution v1.0.0 제정**(`.specify/memory/constitution.md`) — 기존 확정 문서(PRD·backend-prd·git-strategy·부록 A)에서 원칙 6종 도출: Ⅰ도메인 중심 아키텍처 / Ⅱ계약 동기화·문서 위계 / Ⅲ측정 기본 탑재 / Ⅳ프라이버시·저작권 가드레일(NON-NEGOTIABLE) / Ⅴ게스트 우선 / Ⅵmock 테스트 가능성
  - **spec 001 작성**(`specs/001-google-oauth2-login/`) — Google 로그인 명세: US 3종(P1 로그인+JIT / P2 맥락 복귀 / P3 세션 유지·로그아웃) + FR 11 + SC 5, 품질 체크리스트 전 항목 통과
- **Google OAuth 로그인 연동 완성 — 로컬 E2E 전 체인 성공** (브랜치 `feat/google-oauth`)
  - Google Cloud Console OAuth 클라이언트 생성 + Supabase Google 공급자 활성화. Google에는 Supabase 콜백(`…supabase.co/auth/v1/callback`)만, 프론트 주소들은 Supabase Redirect URLs에 등록하는 구조
  - `LoginPage` — `signInWithOAuth`에 `redirectTo: window.location.origin` 추가(로컬 5173/운영 Vercel 각자 제자리 복귀)
  - `HomePage` — **ProfileChip 신설**(로그인 시 헤더에 아바타/이니셜). 🐛 07-09 화면 개편 때 `useMe` 훅이 정의만 되고 미사용이라 **로그인해도 `/users/me` 호출·JIT 프로비저닝이 전혀 안 되던 공백**을 발견·수정 — 첫 조회가 JIT를 트리거하는 연결 복원

### 검증

- 연동 스모크: `{supabase_url}/auth/v1/authorize?provider=google` 직접 호출로 단계별 진단 — ①400 `provider is not enabled`(Enable 토글/Save 누락) ②Google `redirect_uri_mismatch`(다른 GCP 프로젝트에 URI 등록했던 것 정정) 순차 해결
- **로그인 E2E(사용자 실브라우저)**: Google 동의 → 5173 복귀 → 세션 생성(홈 로그인 버튼 소멸) → `auth.users` 레코드(provider=google) 확인
- **JIT 체인**: 백엔드 기동 → ProfileChip 렌더 → `/api/users/me` → **profiles 자동 생성 확인**(id=auth UUID 미러, display_name은 Google 메타에서 자동 수급, role USER). tsc 통과

### 다음 작업

- **spec 001 잔여**: 운영(Vercel) 로그인 검증(SC-005 — Supabase Redirect URLs에 `melolist-v3.vercel.app/**` 등록 + 프론트 재배포) · P2 맥락 복귀(현재 redirectTo는 항상 홈) · P3 로그아웃 UI · FR-009 로그인 이벤트 계측(이벤트 사전 갱신 + 양쪽 PRD 동기화) · (선택) JIT 때 Google avatar_url 수급(현재 null)
- 기존 대기: 배포판 실오디오 지문/허밍 검증(허밍 스파이크 §7.4) · 매칭률 측정 스크립트(C6)·KR SQL(§10)

## 2026-07-10

### 완료

- **M2 백엔드 전 도메인 MVC 구현** (backend-prd 기준, PRD §4.2 구조)
  - search ★M2 핵심: `AcrCloudClient`(identify HMAC-SHA1 서명) + `AcrMetadataClient`(커버 `album.covers.medium`·`youtube[].id`만 추출+도메인 검증, §5.2) + `SearchService` 파이프라인(검증→Top-3 중복제거→병렬 메타보강(score≤0.5 생략)→MUSIC upsert→기록→타이밍 계측 §5.1)
  - music: C1 개정 엔티티(`youtube_video_id` 정본 + `cover_url`), acrid 기준 upsert, 로컬 캐시 텍스트 검색
  - event(신규 최상위 패키지): `event_log`(jsonb) + `POST /api/events`(204, X-Session-Id) — `search_request` 타이밍·no_match `search_failed`는 서버가 직접 기록
  - playlist: CRUD+트랙 추가/삭제/reorder, 비공개=404(존재 비노출)·비소유 변경=403
  - community: 리뷰(1인 1건, 중복 409+동시성 처리), 즐겨찾기(멱등 토글), 댓글(1단 대댓글), 공개 플레이리스트 탐색
  - recommendation: `RecommendationProvider` 인터페이스 슬롯만(M5 대비)
  - common/auth: 예외 4종+핸들러 확장, `PageResponse`, `CurrentUser` 헬퍼. M2 계약(§6.1)·신규 DTO는 snake_case, 기존 ProfileResponse는 camelCase 유지
- `application.yml` ACRCloud 바인딩(.env 변수명 일치) + multipart 10MB 상한 + `.env.example` 갱신
- Supabase 마이그레이션 `create_domain_tables` 적용 — 테이블 8종(music/search_history/event_log/playlist/playlist_music/favorite/review/comment), RLS on·정책 없음. SQL 사본 `backend/db/migrations/`
- **ACRCloud 목업(acr-mock 프로파일)**: 클라이언트 인터페이스 추출 → 실구현(`!acr-mock`)/목업(`acr-mock`) 스위칭. `ACR_MOCK_SCENARIO=hit|nomatch|lowscore|error`. 프론트 searchMock과 같은 곡·시나리오 체계 — 쿼터 소모 없이 클라→서버→DB 파이프라인 테스트 가능
- **GitHub 원격 연결 + push** (`github.com/Gnuke/Melolist-v3`)
  - push 전 전 이력(116커밋) 시크릿 3중 검사(경로·오브젝트 전수·blob 내용) → `.env` 실값 커밋 이력 0건 확인. git-strategy 7장의 "filter-repo 필수" 경고는 과잉 우려로 판명(nuxt-app/.env는 애초 미추적)
  - **브랜치 main 하나로 통합**: feat/scaffold-m1을 main에 fast-forward 병합(이력 보존) 후 로컬·원격 삭제. 이후 기능 개발은 새 피처 브랜치 → PR → main
- **CI 모노레포 경로 분리**: ci.yml → `backend-ci.yml`(paths: backend/\*\*) + `frontend-ci.yml`(paths: frontend/\*\*, Node 22 oxlint+build 신설) — 변경된 쪽만 실행
- **MVP 배포 완료** — 프론트 [melolist-v3.vercel.app](https://melolist-v3.vercel.app)(Vercel) + 백엔드 [melolist-v3.onrender.com](https://melolist-v3.onrender.com)(Render 무료, Docker 자동배포)
  - 🐛 **ACRCloud 3002 버그 발견·수정**: Spring FormHttpMessageConverter가 multipart Content-Type에 `charset=UTF-8`을 붙여 ACRCloud가 `3002 Invalid http content type`로 거부(같은 키로 curl은 정상 → 형식 문제 확정). multipart 바디를 직접 조립하도록 `AcrCloudHttpClient` 수정 — **ACRCloud 실호출 첫 성공**
  - CORS: yml 기본값에 Vercel 도메인 추가 + Render `CORS_ALLOWED_ORIGINS` 환경변수 수정(env var가 yml 기본값보다 우선함에 주의)

### 검증

- `gradlew build` 성공 — SearchServiceTest 6건(ACRCloud mock) + contextLoads 통과
- 실기동(Supabase 연결)으로 `ddl-auto=validate` 통과 + 스모크: 게스트 조회 200 / 무토큰 401 / events 204→event_log 실기록 / 빈 오디오·비오디오 MIME 400 표준 바디
- acr-mock 실기동: 지문/허밍 200+계약 일치, MUSIC upsert·ytimg 커버 폴백 저장 확인, `search_request` 타이밍 기록(허밍 meta_ms 216ms — 3건 병렬 실증)
- acr-mock + 프론트(`MOCK_SEARCH_ENABLED=false`) 클라→서버 E2E: 지문/허밍 결과 표시 + 즐겨찾기 로그인 유도 확인 (사용자 실브라우저)
- **배포 전 체인 검증**: Render 헬스 UP · DB 조회 200 · ACRCloud 실호출 200(노이즈→2004→빈 배열, webm 업로드 수용 확인) · Vercel 번들에 API 주소 정상 반영 · CORS 프리플라이트/실요청 200

### 다음 작업

- **배포판에서 실오디오 지문/허밍 검증** = 허밍 스파이크(§7.4) 실측: 매칭 품질 체감, identify external_metadata 커버리지, `search_request`의 실측 acr_ms
- 매칭률 측정 스크립트(C6) + KR2/KR3 산출 SQL(§10)
- (선택) Google OAuth 설정
- 운영 참고: Render 무료 티어 15분 유휴 시 슬립(콜드스타트 30초+, 필요 시 UptimeRobot 핑) · 프로덕션 MUSIC에 목업 곡 행(acrid `mock-*`) 잔존 — 정리 시 `delete from music where acrid like 'mock-%'`
- M6 체크리스트: acr-mock 소스 처리 방침(유지+프로파일 화이트리스트 or src/test 이동), 배포 정식화(AWS), git-strategy 7장 filter-repo 경고 문구 정정

## 2026-07-09

### 완료

- Melolist 디자인 시스템 확정 (Flame/Iris 팔레트 + Pretendard) — PRD §10 팔레트 대체
- `docs/design-guideline.md` 작성 (Melolist 비주얼 방향성)
- M2 검색 화면 UX 전면 개편 (와이어프레임 1b/1d/1e/1h/1i+1j/1k/1l 구현)
  - SearchPage 신규 구축: RecognitionRing, LiveWaveform, PlaybackCard, ResultsView, FailureView, CoverArt, FavoriteSheet
  - 기존 RecordPanel/RecordingModal/MicButton/SearchResultsList 제거 → useRecorder 훅으로 녹음 로직 분리
  - HomePage/LoginPage 새 디자인 시스템 적용
- 이벤트 계측 추가 (`features/events/` session + track) — event_log 스키마 대응
- 검색 목업 데이터(`mock/searchMock.ts`) + 최근 찾은 곡(recentFinds) 구현
- frontend-design 스킬 커밋 (.agents + skills-lock.json)
- **M2 백엔드 착수 준비 — ACRCloud 키 발급 완료**
  - 프로젝트 2개 생성: 지문(fingerprint)용 + 허밍(humming)용 — 리전·호스트 동일(ap-southeast-1) 확인
  - `backend/.env`에 키 저장: Fingerprint key/secret, Humming key/secret, Metadata API 토큰 2개(MUSIC/HUMMING)

### 검증

- Context7(C7) 라이브러리 사전검증 통과
- 프론트 실기동으로 검색 플로우(녹음 → 인식 → 결과/실패) 화면 확인
- ACRCloud 키 배치 점검: `backend/.env`는 gitignore 적용·git 미추적(시크릿 커밋 위험 없음), Metadata 토큰 JWT 구조 정상(scope `metadata/read-metadata`, 만료 2035). 백엔드 코드에는 아직 참조 0건 — 코드 연동 전 상태

### 다음 작업

- M2 백엔드 구현 시작 — `application.yml`에 ACRCloud 환경변수 바인딩 + `.env.example` 갱신 → 허밍 인식 스파이크 선행
- (선택) Google OAuth 설정

## 2026-07-08

### 완료

- Spring Boot 프로젝트 초기 구성
- React 프로젝트 초기 구성
- Supabase 프로젝트 연결
- Spring Security + Supabase Auth 연동
- 로그인 API 구현
- Postman으로 로그인 검증
- Frontend → Backend → Supabase 인증 흐름 확인

### 검증

- 정상 로그인
- JWT 발급 확인
- 인증 API 정상 응답

### 다음 작업

- 검색 화면 UI
- 음악 검색 API
- ACRCloud 연동