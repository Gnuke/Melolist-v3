# Melolist-v3 · Frontend

Melolist-v3의 프론트엔드 (React SPA). 제품 요구사항은 [`docs/prd/frontend-prd.md`](../docs/prd/frontend-prd.md)(프론트엔드 실행 PRD) 참고.

## 기술 스택

| 구분 | 선택 |
|---|---|
| Core | React 19 + TypeScript + Vite |
| Routing | React Router |
| Server State | TanStack Query |
| Client State | Zustand |
| HTTP | Axios (요청 시 Supabase JWT 자동 주입) |
| 스타일 | Tailwind CSS v4 + shadcn/ui — 라이트/다크 테마(기본 다크, 헤더 토글) |
| Auth | Supabase JS SDK |

## 폴더 구조

```
src/
├─ lib/            # supabase 클라이언트, axios(api), 테마(theme), cn 유틸
├─ stores/         # zustand (authStore: 세션/유저)
├─ features/       # 도메인별 화면 조각·훅·API — search(인식·AI 폴백)·favorites·history·playlists·user·admin·events(계측)
├─ routes/         # createBrowserRouter 설정 (/admin 라우트 포함)
├─ pages/          # 탭 4화면·검색·로그인·프로필 + admin/ (대시보드·유저·음악)
├─ components/     # BottomNav·BottomSheet·ThemeToggle + ui/ (shadcn/ui — npx shadcn add 로 추가)
├─ mock/           # dev 목업 (검색·어드민)
├─ main.tsx        # QueryClient + Router + Supabase 세션 동기화
└─ index.css       # Tailwind v4 + 디자인 토큰
```

`@/*` 는 `src/*` 로 매핑됩니다 (vite.config.ts + tsconfig).

## 실행

```bash
cp .env.example .env.local   # Supabase URL/anon key, API base URL 채우기
npm install
npm run dev                  # http://localhost:5173
npm run build                # tsc -b && vite build
```

## shadcn/ui 컴포넌트 추가

기반(디자인 토큰·`cn`·`components.json`·경로 별칭)은 준비돼 있습니다.

```bash
npx shadcn@latest add button card input
```
