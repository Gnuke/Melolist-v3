# Development Log

## 2026-07-22 총괄 — PR 6건(#15~#20) 전부 병합: 어드민 개통(프론트+백) + 라이트 모드 + AI 폴백 검색(spec 002) + 딥링크 핫픽스

워크트리 병렬 개발 첫날 — 어드민 프론트/백·라이트 모드를 각각 워크트리에서, spec 002 마무리를 원본에서 동시에 진행하고 저녁까지 전부 main 병합·운영 검증 종료. 이후 체제는 **원본=main 상주, 기능 작업=워크트리**(작업 종료 시 정리). 종료 시점 리포는 main 단일(`c517354`), 워크트리 0.

| PR | 내용 | 갈래 |
|---|---|---|
| #15 | **어드민 프론트**(spec 003) — `/admin` 지표 대시보드·곡 카탈로그·사용자 관리. 앱 내 진입점 0·URL 직접 진입 전용(R5 존재 비노출), 가드는 기존 `/users/me` role 재사용, 신규 의존성 0(차트=CSS 바), mock 토글은 프로덕션 미포함 | speckit |
| #16 | **어드민 백엔드**(spec 003) — admin 도메인 신설: AdminAuthInterceptor(`/api/admin/**`, profiles.role DB 매요청 판정 — SecurityConfig 무수정), admin 한정 어드바이스, `admin_audit_log` 동일 트랜잭션 감사, `music.meta_locked` 잠금(자동 보강이 관리자 정정 못 덮음). 실 JWT E2E(감사 8행 누락 0·SC-006 SQL 대조 일치)·테스트 49건. 계약 정본(`specs/003-admin-page-front/contracts/admin-api.md`) 전 항목 일치 | speckit |
| #17 | **라이트 모드** — 프로필 "화면 테마" 토글(localStorage, 기본 다크 유지) + FOUC 방지 부트스트랩 + 하드코딩 다크색 25파일 시맨틱 토큰화(다크 픽셀 동일 매핑, `--tick` 신설) + next-themes 제거 | UI |
| #18 | 🐛 **딥링크 404 핫픽스** — `frontend/vercel.json` SPA rewrite 한 줄. **배포 첫날(07-10)부터 루트 외 전 경로가 URL 직접 진입·새로고침 시 404**였음(클라 내비만 써서 잠복 → URL 전용 /admin에서 표면화). 병합 후 전 라우트 200 실증 | 결함 |
| #19 | **AI 자연어 폴백 검색**(spec 002) — 미매칭/오매칭 시 자연어로 곡 찾기: OpenAI 후보 추천(0~5곡) → 선택 확정이 유일한 저장 시점(acrid=`ai-<hash16>`, source=AI). 일일 쿼터(게스트 3·로그인 10, KST 자정 리셋) + LLM 10s·meta 4s 컷(15s 예산). ai-mock 프로파일 E2E 18항목 | speckit |
| #20 | T031 문서 — 실행 PRD에 어드민 반영(backend-prd §6.2 행·frontend-prd §8 참조) → **spec 003 백 37/37 종결** | docs |

**핵심 발견·진단**:

- **딥링크 404의 정체**: `X-Vercel-Error: NOT_FOUND`(text/plain)로 Vercel 정적 라우팅 계층 확정 — 앱 미로드라 OAuth/Supabase 리디렉션 URI와 무관(쿠키 없는 curl로도 재현). SPA는 진입만 `/`면 이후 전부 클라 라우팅이라 지금까지 안 들켰던 것.
- **모델 교체(T030 실키 스모크)**: gpt-5-mini는 2026-12-11 서비스 종료 예고 + 5.4 계열은 reasoning_effort `minimal` 미지원(400) → 기본값 **gpt-5.4-mini + low**(쿼리당 ~3원). 실쿼리 7건 전부 정답 1순위.
- **운영 스모크(병합 후, 사용자 키 등록)**: 1차 호출 웜업 타임아웃(`ai_ms=10133` → 502, 계약대로) → 2차 벚꽃엔딩 hit(서버 9.5s) → 3차 Ditto hit(4.8s) → 4차 429 quota(limit 3·reset_at 자정). **Render 슬립 후 첫 AI 검색은 10s 컷 타임아웃 가능 — 프론트 F4 재시도로 커버, 베타 때 Starter 전환과 같이 볼 것**. 테스트 이벤트 4행 삭제.
- **병합 순서 역전**: 계획(002 먼저)과 달리 002가 Render 키 등록 대기라 **admin 선병합** — 충돌면 격리 커밋(`53f88f4` MusicService 가드 독립) 덕에 002 rebase 3회 전부 사실상 자동 병합(`.specify/feature.json` 포인터 정도). FallbackSearchView만 라이트 스윕 이전 작성이라 하드코딩 보더 3곳 후속 치환.
- **T021 어드민 실서버 검증 완료(사용자)** — 딥링크 핫픽스 후 /admin 운영 정상.

**남은 것**: KR1 첫 실측(곡 셋 오디오 대기)·KR2 재확인(실사용 데이터). 후속 후보: 라이트 모드 게스트 토글 진입점·OS prefers-color-scheme 추종, 어드민 후속 화면(백 초과분 API — 곡 상세/삭제·사용자 상세·모더레이션).

## 2026-07-21 — 프로필 사진 로딩 깜빡임 제거 (✅**PR #14 병합** `3fe250f`, 브랜치 `fix/profile-avatar-flicker`)

- **증상**(07-20 제보 1순위): 화면 진입·새로고침마다 프로필 칩이 **기본 이니셜 → 실사진** 순서로 깜빡임.
- **원인 2겹 + 구조 1**: ①주범 — `['me']` 쿼리 캐시가 페이지 로드마다 빈 상태라 `GET /users/me` 왕복(Render 콜드스타트 시 수 초) 동안 이니셜이 먼저 렌더된 뒤 실사진으로 교체 ②`avatarUrl`을 알아도 `<img>` 로드 완료 전 공백 구간 존재 ③같은 아바타 렌더 코드가 ProfileCorner·ProfileSheet·ProfilePage 3곳 중복(드리프트 온상).
- **수정 3종**:
  - **useMe** — 조회 성공 시 프로필을 localStorage(`melolist.me`) 사본으로 저장, 다음 진입부터 `placeholderData`로 즉시 렌더(백그라운드 조용히 최신화) + `staleTime` 5분(프로필은 ProfilePage에서만 바뀌고 그땐 setQueryData 직접 반영이라 안전). 계정 가드 `cached.id === session.user.id`(Profile.id는 JWT sub 미러 — UserService.provision 확인) + 로그아웃 시 `clearCachedMe()`(계정 전환 대비).
  - **공용 `ProfileAvatar` 신설**(features/user) — 3곳 중복 렌더 통합. 사진 URL이 있으면 이미지 로드 전에도 **이니셜 대신 iris 원 배경만** 노출 → "이니셜→사진" 교체 자체가 발생하지 않음. 이니셜은 URL이 없을 때만.
  - **ProfilePage** — 별명·사진 수정 반영(applyMe)이 쿼리 캐시와 로컬 사본을 함께 갱신(수정 직후 새로고침에 옛 사진 방지).
- **검증**: `tsc -b && vite build`·oxlint 통과, 로컬 E2E 사용자 확인(첫 로드 1회 이니셜=사본 없음 정상, 이후 새로고침·탭 이동 무깜빡임). 프론트 전용 변경이라 Render 무관 — Vercel 자동 재배포만. ✅**운영 확인 완료(07-22)** — 깜빡임 미감지. 07-20 대기분(플레이리스트 전 플로우·기록 ♡/담기·프로필 수정)도 07-21 운영 실화면 확인 완료 → 운영 확인 전부 종료.
- **남은 것**: ①KR1 첫 실측(곡 셋 오디오 준비되면) ②KR2 재확인(meta 4s 이후 데이터).

## 2026-07-20 (2) — Render 배포 실패(exit 1) 진단: Supabase pooler 한도 소진 (PR #13)

- **증상**: PR #12 병합 후 Render 배포가 원인 표시 없이 exit 1. 구버전은 계속 서빙(무중단 배포라 신 인스턴스만 사망).
- **진단**: pg_stat_activity에서 풀러 경유 JDBC 커넥션 **15/15 소진**(무료 티어 session pooler 서버 커넥션 한도) — 구 Render 인스턴스 10 + 로컬 dev 서버 5. 신 인스턴스가 기동 시 커넥션을 하나도 못 얻어 HikariCP 초기화 실패 → 부팅 사망. 로컬 서버 종료 즉시 15→10으로 감소(실증). 이전 배포들이 성공한 건 그때 로컬이 꺼져 있었기 때문.
- **조치**: 로컬 종료 후 재배포 성공(사용자). **재발 방지(PR #13 병합)**: Hikari `maximum-pool-size: 5`·`minimum-idle: 2` 기본값 — 로컬+신구 인스턴스(5×3)=15로 전 환경 동시 기동 보장, env로 조정 가능.
- **교훈**: Supabase 무료 pooler는 한도 15 — 커넥션 풀을 쓰는 프로세스 수(로컬·신구 배포·스크립트)를 항상 셈에 넣을 것. 배포 실패가 "원인 없이 exit 1"이면 pg_stat_activity부터.

## 2026-07-20 — 플레이리스트 + 프로필 화면 (M3 화면 마무리, ✅**PR #12 병합** `e703c9c` · 커밋 6건 · 재배포 성공)

### 완료

- **frontend `/playlists` 목록 + `/playlists/:id` 상세**: 목록은 `useQuery`(수정 최신순, 백엔드 비페이징 계약 그대로) + `initialized` 가드 패턴. 상세는 공개면 게스트도 조회(뒤로가기·빈 상태 카피가 세션 유무에 따라 분기), 비공개 비소유는 백엔드 404 → "찾을 수 없어요" 화면. 소유자 편집: 정보 수정(생성·수정 공용 `PlaylistFormSheet`), 삭제(확인 시트, destructive), 곡 빼기(X), **순서 편집 모드**(↑/↓ — 행당 버튼 수를 늘리지 않으려 모드 토글, 이동 즉시 낙관 반영 후 reorder PATCH, 실패 시 재조회 롤백)
- **담기 플로우**: `AddToPlaylistSheet` — 즐겨찾기 행의 담기(ListPlus) 버튼 → 내 플레이리스트 선택 or **새로 만들고 바로 담기**(플레이리스트 0개면 바로 생성 모드). 중복 409는 "이미 담겨 있는 곡이에요"로 안내. 담기 원천을 즐겨찾기로 한 이유: 검색 결과에는 music id가 없고(acrid뿐, upsert 비동기) 상세 계약이 music id 기반이라 ♡ 저장 → 담기 순서가 자연 흐름
- **공용 `BottomSheet` 셸 추출**(FavoriteSheet 패턴): 폼·확인·선택 시트 3종이 재사용. 스위치 on은 뉴트럴 전경색 — flame은 시트 저장 버튼 1개(§10 뷰당 주 액션 1개)
- **Bottom Nav 4탭**: 홈·즐겨찾기·플레이리스트·기록. design-guideline "플레이리스트 피드 중심 화면 지양"은 유지 — 탭은 진입점일 뿐, 홈·검색 중심 구조는 그대로
- **backend 검색 기록 `favorited`**(전 세션 착수분 마무리): `SearchHistoryResponse.favorited` + `FavoriteRepository.findByUserIdAndMusicIdIn` 페이지 단위 일괄 조회(N+1 방지 유지). **테스트 NPE 수정**: `@InjectMocks`가 새 생성자 인자에 null을 넣어 컴파일은 통과·런타임 실패하던 것 → `@Mock FavoriteRepository` 추가 + favorited true/false 검증 보강
- **기록 화면 ♡ 토글 + 담기 연결**(사용자 로컬 확인 중 지적): matched 행에 담기(ListPlus)·♡ 토글(favorited 초기 상태, `music_id`로 POST — MUSIC 행이 이미 있어 acrid 재시도 불필요) 추가. 같은 곡이 여러 기록에 있으면 캐시에서 함께 뒤집는다(favorited는 곡 단위). `['favorites']` 무효화로 즐겨찾기 목록과 동기
- 🐛 **홈 "최근 찾은 곡" 목업 잔재**(사용자 로컬 확인 중 지적): 선반은 localStorage(`melolist.recent-finds`) 원천인데 07-16 목테스트 곡(acrid `mock-*`)이 localhost 오리진에 잔존 — DB·목업 스위치는 무관(둘 다 깨끗함 확인). → recentFinds에 `mock-*` 읽기 자가 정리 + 쓰기 가드(프론트 searchMock·백엔드 acr-mock 공통 방어)
- **홈 셸프 하이브리드 전환**(사용자 문제 제기 "어차피 기록에 남잖아" → 안 3종 중 하이브리드 확정): `useRecentFinds` 훅 — **로그인=서버 검색 기록**(matched만 곡 단위 dedup 후 3곡, 기기 간 일관·기록 삭제와 동기) / **게스트=localStorage 유지**(게스트 검색은 서버 기록에 안 남아 로컬이 유일한 원천, 게스트 우선 원칙 V). 하이드레이션 전엔 빈 목록(로컬→서버 셸프 깜빡임 방지). localStorage는 M2 임시 구조("서버 SearchHistory는 M3" 주석)의 게스트 폴백으로 역할 축소
- **프로필 화면 + 아바타 업로드**(사용자 요청 — display_name=별명 확인): ①Supabase Storage `avatars` **공개 버킷**(2MB·jpeg/png/webp 한정) + 본인 폴더(`{user_id}/…`)만 쓰기/삭제 RLS(부록 A-2 "Storage만 RLS" 결정 준수, 마이그레이션 `create_avatars_bucket` 적용 + SQL 사본 `backend/db/migrations/`) ②backend `PATCH /api/users/me`(UpdateMeRequest — null=유지, 별명 트림·공백 400, avatarUrl https만, user 도메인 camelCase 계약 유지, UserServiceTest 4건) ③frontend `/profile` ProfilePage — 별명 수정 + 사진 변경(클라에서 512px 정사각 중앙 크롭 JPEG 변환 → supabase-js로 Storage 직접 업로드 → public URL을 PATCH로 저장). **파일명을 매번 새로**(같은 경로 덮어쓰기는 CDN 캐시로 구 이미지 잔존) 하고 이전 파일은 best-effort 삭제. 진입점: 프로필 시트 [프로필 관리](주 액션, 로그아웃은 outline 유지). ⚠️ 커스텀 아바타는 JIT 자가 치유(avatar null일 때만 Google 사진 주입)와 충돌 없음
- **프로필 칩 전 탭 노출**(사용자 문제 제기 "어느 탭에서도 로그아웃 가능해야" — 동의): HomePage 내부에 있던 칩+시트를 `ProfileCorner`로 추출, 즐겨찾기·플레이리스트·기록 헤더 우측에도 배치. 탭 4개는 같은 층위라 계정 진입점을 공통화(게스트면 미렌더 — 로그인 유도는 화면별 가드 몫)
- 검증: backend 전체 테스트 통과, frontend `tsc -b && vite build` 통과, oxlint 신규 경고 0

### 남은 것 (다음 세션 확인 순서)

1. **프로필 사진 로딩 깜빡임(사용자 제보 — 첫 번째로 확인)**: 배포 서버 기동 후 검색 화면에서 리렌더 시 프로필 사진이 바로 안 뜨고 **기본 이니셜이 먼저 보였다가 실제 사진으로 바뀜**. `['me']` 캐시 없는 첫 조회 + `<img>` 네트워크 로드가 순차라 생기는 것으로 추정 — 운영 재현 확인 후 개선 검토(아바타 프리로드, 로드 완료까지 플레이스홀더 유지, `['me']` staleTime 등)
2. 운영 실화면 확인: 플레이리스트 생성→담기→순서→삭제 전 플로우 + 기록 ♡·담기 + 프로필 별명/사진 업로드 (Render 웜업 후)
3. 기존 대기: 운영 실검색 확인(유튜브 링크·♡), KR1 첫 실측(곡 셋 오디오), KR2 재확인(meta 4s 이후 데이터)

## 2026-07-16 총괄 — PR 8건(#4~#11) 전부 병합: 유튜브 링크 수정 + M2 측정 도구 완비 + M3 저장/목록/내비 개통

유튜브 링크 미표시 제보에서 출발해, 하루에 M2 측정 잔여를 닫고 M3의 저장·목록·내비를 개통했다. 상세는 아래 (1)~(8) 항목.

| PR | 내용 | 갈래 |
|---|---|---|
| #4 | 🐛 유튜브 링크 미표시 — 메타 `query.artists` 문자열→**배열**(주범) + 타임아웃 3s→4s(3s 컷은 videoId까지 잃는 전제 오류) | 결함 수정 |
| #5 | 즐겨찾기 실저장 — `POST /favorites`에 acrid 수용, ♡ 토글, `favorite_click`에 acrid·rank·score(매칭률 실측 원천) | M3 착수 |
| #6 | KR 산출 SQL(`backend/db/queries/kr_metrics.sql`) + 운영 첫 산출 — **KR2 허밍 p95 5,708ms ✅통과**(최적화 전 12.4s) | M2 DoD #3 |
| #7 | 매칭률 측정 스크립트(`backend/scripts/match-rate/`) — Top-3 판정·KR1 리포트, acr-mock 스모크 통과 | M2 C6 |
| #8 | 즐겨찾기 목록 `/favorites` + authStore `initialized` 가드 + PageResponse snake_case 정비 | M3 |
| #9 | 검색 기록 `/history` + `GET/DELETE /api/search/history`(일괄 조인·소유자 한정 삭제) | M3 C4 |
| #10 | 🐛 PlaybackCard AbortError 흡수 + frontend-prd §10 DS 문서 드리프트 해소 | 정리 |
| #11 | Bottom Navigation 3탭(홈·즐겨찾기·기록) — 진입점 통합, 검색 플로우 제외, 미니 플레이어 보류 | M3 |

**핵심 진단(어제 "의도와 다른 곡" 제보)**: 07-15 밤 실측에서 top-1 score 0.94+ 4건은 정상 매칭 — **사용자 허밍 기술 문제 아님**. 오매칭은 0.47~0.67 구간으로, 의도곡이 ACR 허밍 DB에 없을 때 "가장 가까운 남의 곡"이 나오는 패턴 = **DB 커버리지 문제 유력**. 확정은 ♡ 실측 데이터(PR #5)·매칭률 스크립트(PR #7) 실행으로.

**남은 것**:
- 운영 실검색 확인 — 유튜브 링크 표시(PR #4)·♡ 저장(PR #5)·목록/내비(PR #8·9·11) 실화면 검증
- KR1 첫 실측 — 테스트 곡 셋 오디오(지문 30·허밍 20) 준비 후 `match-rate` 실행
- KR2 재확인 — meta 4s 완화 이후 데이터로(주간 추이 쿼리), 6s 예산 빠듯해질 수 있음
- **플레이리스트 화면(M3 마지막 덩어리) — 다음 세션에 진행하기로 함**

## 2026-07-16 (8) — Bottom Navigation (M3, 브랜치 `feat/bottom-nav`)

- **하단 탭 내비 신설**(`components/BottomNav.tsx`): 홈 / 즐겨찾기 / 기록 3탭. router에 `TabLayout`(Outlet+BottomNav) 도입 — **탭 화면에만 노출**, 검색 플로우(`/search/*`)·로그인은 몰입 유지를 위해 제외. 게스트가 즐겨찾기/기록 탭 진입 시 기존 페이지 가드가 /login(next)으로 처리(일관)
- **DS 준수**: 활성 표시는 전경색 전환+스트로크 강조만 — flame은 뷰당 주 액션 1개 규칙이라 내비에 쓰지 않음. `bg-background/85 + backdrop-blur` + 상단 헤어라인, iOS safe-area 대응(`env(safe-area-inset-bottom)`)
- **진입점 통합**: 프로필 시트의 임시 [즐겨찾기]/[검색 기록] 버튼 제거(시트는 계정 영역만), 탭 3화면 하단 여백 pb-28로 내비와 겹침 방지
- 미니 플레이어는 design-guideline("하단 미니 플레이어 고정 지양")에 따라 보류 — M3 잔여는 플레이리스트 화면

## 2026-07-16 (7) — 소형 정리: PlaybackCard AbortError + frontend-prd §10 갱신 (브랜치 `chore/playback-abort-and-ds-doc`)

- 🐛 **PlaybackCard unhandled rejection**: `void ws.load(url)`이 프라미스를 버려서, 언마운트 시 `destroy()`가 로드 중 fetch를 중단하면 AbortError가 unhandled로 떴다(StrictMode 이중 이펙트에서 상시 재현 — 07-16 dev 로그 실측). → `.catch(() => {})`로 의도된 중단 흡수
- 📝 **frontend-prd §10 디자인 시스템 갱신**: 07-09 M2 개편 때 교체된 DS(Ink 뉴트럴/#0a0a0c·Flame #FF5A3C 뷰당 1 주 액션·Iris #6E5CFF 인식 전용·Pretendard)가 문서에는 구 팔레트(#090909/#5B8CFF/Inter)로 남아 있던 드리프트 해소. 정본(claude.ai/design `_ds` 토큰 + docs/design-guideline.md) 위계 명시

## 2026-07-16 (6) — 검색 기록 화면 (M3 C4, 브랜치 `feat/search-history-page`)

### 완료

- **backend `GET/DELETE /api/search/history`**(M2 write의 조회/삭제 완성): SearchHistoryService — top 곡 스냅샷은 페이지 단위 `findAllById` 일괄 조인(N+1 방지), no_match/곡 소실이면 `music: null`. DELETE는 `findByIdAndUserId` 소유자 한정(비소유=404, 존재 비노출). SecurityConfig 변경 불필요(`anyRequest().authenticated()`에 걸림 — 검색 POST 3종만 permitAll이라 매처 순서 함정 없음)
- **frontend `/history` HistoryPage**: 즐겨찾기 목록과 같은 패턴(useInfiniteQuery 20개+[더 보기], 캐시 필터 삭제, 빈 상태·스켈레톤·재시도, `initialized` 가드) — matched 행=커버·곡정보·모드·시각·허밍 일치율 배지·[듣기]·[삭제], no_match 행=SearchX 플레이스홀더·"찾지 못했어요". 진입점: 홈 프로필 시트 [검색 기록]
- 테스트: SearchHistoryServiceTest 3건(일괄 조인+no_match null·소유자 삭제·비소유 404)

## 2026-07-16 (5) — 즐겨찾기 목록 화면 (M3, 브랜치 `feat/favorites-page`)

### 완료

- **`/favorites` FavoritesPage 신설**: `GET /api/favorites` useInfiniteQuery(20개 + [더 보기]) — 커버·제목·아티스트·[듣기]·[해제(채운 하트)] 행, 해제는 캐시 필터로 즉시 반영, 빈 상태(♡ 안내 + [노래 찾으러 가기]) · 로딩 스켈레톤 · 오류 재시도. 진입점: 홈 프로필 시트에 [즐겨찾기] 버튼 추가
- **비로그인 가드**: `/login`(state.next=/favorites) 리다이렉트. **authStore에 `initialized` 플래그 추가** — 세션 하이드레이션(getSession 비동기) 전에 null을 비로그인으로 오판해 새로고침 직후 로그인으로 튕기는 문제 방지(판단 보류 중 스켈레톤)
- **PageResponse snake_case 정비(backend)**: `@JsonNaming` 누락으로 `totalItems`가 camelCase로 나가던 것을 첫 프론트 소비자가 생기는 시점에 `total_items/total_pages`로 통일(§4.3 계약 규약). 기존 소비자 없음 — 안전

## 2026-07-16 (4) — 매칭률 측정 스크립트 (C6, 브랜치 `feat/match-rate-script`)

### 완료

- **`backend/scripts/match-rate/`** — `match-rate.mjs`(Node 18+ 내장 fetch/FormData, 의존성 0) + `manifest.example.json` + README. 곡 셋(manifest)을 `/api/search/*`에 순차 투입(기본 간격 2s — ACR 과금 보호) → **Top-3 판정**: acrid 우선, 없으면 제목+아티스트 느슨 일치(괄호·대소문자·공백 무시, v2 cleanQueryText 계승) → 모드별 매칭률 + KR1(지문 ≥80%·허밍 ≥50%) 판정 표 + JSON 리포트(`reports/`)
- **가드레일**: 오디오·리포트·실측 manifest는 .gitignore(원칙 IV — 오디오 커밋 금지). 운영 대상 실행 시 search_request가 지표에 섞이는 주의사항 README에 명기
- **acr-mock 스모크 통과**: HIT rank0(제목-아티스트) · MISS(무관 곡) · HIT rank2(괄호 표기 흡수) · HIT rank1(acrid 우선, 제목 불일치여도) — 요약 표·판정·리포트 저장 확인. 테스트 잔여물(mock 곡 4행·search_request 4건·로컬 픽스처) 정리

### 남은 것 — 실측은 준비물 필요

- **테스트 곡 셋 오디오**(지문 30: 원음 마이크 녹음 클립 / 허밍 20: 직접 부른 녹음) 준비 후 실행 → KR1 첫 실측. 허밍 오매칭 원인(사용자 허밍 vs ACR 허밍 DB 커버리지) 정량 판정도 이 실측으로 확정

## 2026-07-16 (3) — KR 산출 SQL + 운영 첫 산출 (M2 DoD #3, 브랜치 `chore/kr-metrics-sql`)

### 완료

- **`backend/db/queries/kr_metrics.sql`**: KR2 p95(모드별, rollup 전체) · KR2 구간 분해(acr/meta/upsert p95 — 병목 식별용) · KR3 완료율(세션 단위) · 주간 추이(금요일 체크인용) · 실패 사유 분포. 해석 주의 주석: 07-14(응답 경로 분리)·07-16(메타 수정) 전후 비교 금지, no_match도 KR2 모수 포함
- **운영 첫 산출(DoD #3 "SQL이 값을 반환" 충족)**:
  - **KR2 — 07-14 최적화 이후 허밍 p95 5,708ms ✅통과**(n=10, 최적화 전 실측 12.4s → 절반 이하). 구간: acr p95 2,086 + meta p95 3,630(구 3s 컷 시절 데이터). 지문은 14일 창 p95 4,722ms 통과
  - ⚠️ meta 4s 완화(PR #4) 이후 데이터는 아직 없음 — 링크 커버리지를 얻는 대신 p95가 +1s 근처까지 오를 수 있어 **다음 실사용 데이터로 재확인 필요**(6s 예산 빠듯)
  - **KR3 — 24%**(visit 25세션 중 완료 6): 베타 배포 전이라 개발·테스트 세션이 분모를 오염 — 목표(70%) 대비 판정은 베타 이후 유효
  - 실패 분포: 지문 no_match 11·bad_audio 7 / 허밍 low_score 4·bad_audio 4·timeout 3(최적화 전 시절)

## 2026-07-16 (2) — 즐겨찾기 실저장 (M3 착수, 브랜치 `feat/favorite-save`)

### 배경 — "응답 정확도 체크도 할 겸"

- 사용자 제보: 허밍 결과가 의도한 곡과 다른 경우가 있는데 원인(허밍 vs DB)을 모르겠다 → 즐겨찾기 실저장을 당겨서 **♡ = "내가 찾던 곡" 실측 신호**로 삼기로 함. `favorite_click`에 acrid·rank·score를 추가해 매칭률(C6)·순위 분포의 원천 데이터 확보
- 07-15 밤 실측 진단: top-1 score 0.94+ 4건은 정상 매칭(귀로·Landing in Love 등), 0.47~0.67 구간이 오매칭 — 허밍 기술보다 ACRCloud 허밍 DB 커버리지가 유력(고신뢰 매칭이 잘 되는 걸로 보아 사용자 허밍은 문제 아님)

### 완료

- **backend**: `POST /api/favorites`가 `music_id` **또는 `acrid`** 수용(검색 결과 화면엔 musicId가 없음 — §5.3 비동기 upsert라 응답 시점 존재 보장도 안 됨) + 저장 행(`{id, music, created_at}`) 반환(해제 DELETE에 music.id 필요). add는 의도적으로 무트랜잭션 — unique 충돌 후 같은 tx 재조회는 PG aborted라 조회·저장을 분리하고 충돌 시 기존 행 반환(멱등). LAZY music 대신 이미 조회한 Music으로 응답 구성
- **frontend**: 로그인 상태 ♡ = 토글(`features/favorites/api.ts`) — 404(upsert 경합) 시 1.5s 후 1회 재시도, 곡별 in-flight 가드, 하트 채움+토스트. 게스트는 기존 유도 시트 유지. `favorite_click` properties 확장: `acrid`, `rank`(0~), `score`, `action`(add|remove|login_prompt) — 양쪽 PRD 이벤트 사전 동기화(원칙 II)
- **테스트**: FavoriteServiceTest 5건(acrid 저장·멱등·404·400·unique 경합 수렴)

## 2026-07-16 — 유튜브 링크 미표시 수정 (메타 보강 쿼리·타임아웃)

### 배경 — "결과 화면에 유튜브 링크가 안 나온다" 제보

- 운영 실측(07-15 밤 세션): 허밍 검색으로 저장된 최근 19곡 중 **videoId 획득 1곡** — 듣기 버튼·커버가 거의 항상 사라지는 상태. 프론트는 `youtube_url` 없으면 버튼 숨김이 정상 동작이므로 백엔드 보강 실패가 원인
- 원인 분해(Metadata API 직접 호출로 실증):
  - **① 쿼리 형식 오류(주범)**: `query.artists`를 **문자열**로 보내면 API가 대부분 `data:[]` 반환. **배열**(`["NAUL"]`)로 바꾸면 동일 곡(귀로·Ditto·SSFW·끝사랑·Landing in Love) 전부 youtube id 매칭. 문자열도 가끔 매칭돼(Amy Grant 등) "아주 가끔만 링크가 뜨는" 증상이 됨
  - **② meta 3s 컷의 전제 오류(가중)**: 07-14 최적화는 "늦으면 커버만 잃는다"고 전제했지만, 타임아웃 시 `MetaEnrichment.EMPTY`라 **videoId까지 소실 → 듣기 버튼·ytimg 폴백 모두 사라짐**. 실측 정상 조회가 2.4~3.6s 분포라 3s 컷에 상시 걸림(07-15 밤 10건 중 6건 meta_ms 3.4~3.6s = 타임아웃)

### 완료

- **① `AcrMetadataHttpClient.buildQueryJson` — artists를 배열로**(`putArray`). backend-prd §5.2에 형식 규칙 명문화
- **② meta 타임아웃 3s→4s**: 실측 조회 분포(2.4~3.6s)를 커버하면서 KR2 예산 안(acr ~1.5s + meta 4s ≈ 5.5s ≤ 6s). 5s는 최악 겹침 시 예산 초과라 배제. application.yml·AcrCloudProperties 기본값·프론트 15s 주석·§5.3 표 동기화

## 2026-07-14 (2) — 검색 응답 최적화 (브랜치 `perf/search-latency`)

### 배경 — 첫 실측 데이터가 가리킨 병목

- 운영 검증 후 사용자 체감 "6초 이상 걸리는 경우 있음" 제보 → `search_request` 22건 구간 분해: **지문 p95 5.7s(예산 내), 허밍 p95 12.4s·최대 14.5s(예산 초과)**. 최악 케이스 분해 = acr 6.7s + meta 6.1s + upsert 1.7s — 오디오가 아니라 **응답 경로에 얹힌 뒷단 작업**이 주범 (녹음 품질 개선은 데이터상 우선순위 아님 → 기존 조건부 결정 유지)

### 완료

- **① upsert 비동기 분리(§5.3 확정)**: 응답은 tracks+enrichments만으로 생성됨을 확인 → MUSIC upsert·SearchHistory·search_request 기록을 가상 스레드 후처리로 분리. `total_ms`는 응답 경로만 계측(upsert_ms는 비동기 측정치). acrid 동시 경합은 MusicService가 이미 재조회 수렴 처리. no_match 경로의 기록 3건도 동일 분리
- **② meta 타임아웃 5s→3s**: 실측 meta_ms 최대 6.1s → 3s 컷. 실패는 EMPTY 수렴 + 커버 ytimg/플레이스홀더 폴백(§5.2)이 받아 UX 손실 없음
- **③ 프론트 15s 타임아웃 + [취소] 버튼**: 인식 요청 axios `timeout: 15000` + AbortController(언마운트 시에도 중단). 타임아웃→F4(blob 보존 재시도), `reason: timeout` 구분. 검색 중 화면에 [취소] — 요청 중단 후 녹음 화면 복귀, `reason: cancelled`. 이벤트 사전 reason 2종 추가(양쪽 PRD 동기화, 원칙 II)

### 검증

- 백엔드 `gradlew build`(테스트 — 비동기 후처리는 Mockito `timeout()` 검증으로 전환) + 프론트 tsc·oxlint·build 통과
- **acr-mock 실기동 E2E**: 응답 200 **0.75s**(total_ms 647) 반환 후 upsert_ms **728**이 비동기 완료 — search_request 레코드·MUSIC 3행 적재 확인(직전까지는 이 728ms가 응답에 포함됐음). 테스트 행 정리 완료

### 후속 — 취소 확인 시트 (사용자 로컬 확인 피드백, 브랜치 `fix/search-cancel-confirm`)

- 피드백: "취소가 즉시 실행되고, 취소 후 녹음이 멋대로 다시 시작된다 — 의사를 먼저 묻고, 계속하면 하던 것을 이어가고, 확정하면 검색 시작 화면으로 나가야"
- **useRecorder에 pause/resume 추가**: MediaRecorder.pause + 자동정지 타이머·경과 인터벌 정지, 재개 시 시작시각을 정지 시간만큼 이동(경과·진행률·durationMs에서 정지 구간 제외). 일시정지 중 RMS는 무음검증 분모에서 제외(F1 오탐 방지) + 링 진행률 프리즈(`getElapsedMs`) + "잠시 멈췄어요" 문구
- **QuitConfirmSheet 신설**(FavoriteSheet 패턴, 주 버튼=계속하기): 녹음 중 취소(헤더)→일시정지+시트(계속 녹음/그만두기), 검색 중 [취소]→요청 유지+시트(계속 기다리기/그만두기 — 대기 중 결과 도착 시 시트 자동 닫힘). 확정 시 홈 복귀(자동 재녹음 제거), `reason: cancelled`는 확정 취소만 기록

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

### 운영 검증 완료 — spec 001 종료 (같은 날 후속)

- **PR #1 병합**(`35406cd`, CI 통과: Backend 50s·Frontend 22s·Vercel 프리뷰) → Vercel 재배포 확인(프로덕션 번들에 신규 계측 마커 검증) → Render 웜업 후 실사용자 로그인
- **SC-005 통과 증거**: Supabase auth 로그 `/callback` 302 `auth_event: login`(referer=`melolist-v3.vercel.app`, provider google) + `event_log`에 `login_started`→`login_succeeded` 운영 경유 적재. 운영 실검색 1건도 확인(`search_request` acr_ms 3077, 주변 소음 no_match 정상)
- 📌 사후 판명: 오전 첫 E2E는 배포판(구 번들)에서 수행된 것 — 같은 Vercel 탭 세션 ID로 확인. 로그인 이벤트 0건에는 구 코드 요인도 있었음(keepalive 수정은 로컬·운영 모두 유효 실증)
- **spec 001 SC 5종 전부 충족 — Google OAuth2 로그인 기능 완료.** 브랜치 `feat/google-oauth` 정리

### 다음 작업

- **M2 측정**: 실오디오 지문/허밍 검증(허밍 스파이크 §7.4) · 매칭률 스크립트(C6) · KR SQL(§10) = M2 DoD 완결 (허밍 실측은 환경 되는 날 — 가짜 마이크용 ffmpeg 준비됨)
- 이후 **M3 저장**(즐겨찾기 실저장부터 — ♡ 버튼·로그인 유도는 이미 완성)

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