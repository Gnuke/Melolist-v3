# Melolist-v3 Frontend PRD (React SPA)

> **문서 상태:** v1.0 (2026-07-08) · 근거: `PRD.md`(마스터 v0.1) + `brainstorming.md`(0장 OKR · 6장 M2 설계 · 7장 이미지 소싱)
> **문서 위계:** `PRD.md` = 제품 전반(비전·마일스톤 총괄). 본 문서 = **프론트엔드 실행 PRD** — 화면·UX·계측의 요구사항을 확정한다. 충돌 시 본 문서가 최신(브레인스토밍 결정 반영).
> **계약 동기화:** §8의 API 계약·이벤트 사전은 `backend-prd.md` §6.1과 동일해야 하며, 변경 시 양쪽을 함께 갱신한다.

---

## 1. 역할과 경계

**프론트엔드(React SPA)가 하는 일**
- 녹음(MediaRecorder, webm/opus) + 파형 시각화(wavesurfer) + **업로드 전 사전 검증**(길이·RMS — F1 선차단)
- 모드별 검색 플로우(지문/허밍)와 실패 UX 4유형(F1~F4) 렌더
- 결과 카드 렌더: Top-3, 커버 이미지 + `onError` 폴백, score 노출 규칙
- Supabase JS SDK 로그인 → JWT를 Axios 인터셉터로 첨부(백엔드는 검증만)
- 이벤트 발화: **클라만 아는 것**(visit, 녹음 시작, 렌더 완료, 클라 측 실패) + 세션 UUID 관리
- KR2의 클라 구간 계측(`client_ms`: 녹음 종료→렌더 완료)

**프론트엔드가 하지 않는 일**
- ACRCloud 직접 호출(키는 서버 전용) — 항상 `/api/search/*` 경유
- 커버 URL 소싱·검증(서버가 `cover_url` 확정) — 프론트는 표시와 onError 폴백만
- 이미지 다운로드·재가공 — `<img src>` 핫링크 렌더만 (저작권 가드레일)
- 서버가 직접 아는 이벤트(`search_request` 타이밍, no_match) 기록

---

## 2. 기존 PRD 대비 변경/유지 결정

### 2.1 변경 (brainstorming.md 반영)

| # | 항목 | 기존 PRD / 현재 구현 | 변경 | 상태 |
|---|---|---|---|---|
| C1 | 검색 플로우 | 녹음→수동 정지→재생 확인→[검색] 수동 클릭 (모드 무관 동일) | **모드별 분리**: 지문 = 12초 자동 종료 + 정지 즉시 자동 검색 / 허밍 = 수동 정지(20초 컷) + 확인 후 검색 | ✅ D1·D2 확정 (2026-07-08) |
| C2 | 결과 카드 이미지 | 없음(텍스트만) | 좌측 56px 라운드 정사각 이미지 — `cover_url` → videoId 썸네일 → 플레이스홀더 **2단 onError 폴백** | ✅ D3 확정 |
| C3 | 결과 노출 | 제한 없음 | **Top-3 고정** (KR1 판정 기준과 정합) | ✅ 확정 |
| C4 | 실패 UX | 무결과/저신뢰 한 덩어리, raw `err.message` 노출 | **4유형 분리**(F1~F4, §6) + F4는 blob 보존·재전송, raw 에러 노출 제거 | ✅ 확정 (M2 In Scope) |
| C5 | 이벤트 계측 | 없음 | `visit`/`search_started`/`search_result_shown`/`search_failed` 발화 + 세션 UUID(`X-Session-Id`) | ✅ 확정 (KR3 원천) |
| C6 | 즐겨찾기 버튼 | M3(저장 기능과 함께) | **M2에 버튼만 선노출** — 클릭 시 "로그인하면 저장됩니다" 유도 시트 (저장 동작은 M3) | ✅ D4 확정 (2026-07-08) |
| C7 | 사전 검증 | 없음 | 업로드 전 길이(지문 3초/허밍 8초 미만 경고) + RMS 음량 체크 — **서버 왕복 없이 F1 차단** | ✅ 확정 |
| C8 | 듣기 버튼 | 유튜브 새 탭 | **유지 확정** — `youtube_url`(watch?v=) 새 탭. 인라인 임베드·미니플레이어는 M3 | ✅ v2 계승 |

### 2.2 유지 (변경 없음 — PRD.md가 계속 유효)

- 기술 스택 전체: React 19 + TS + Vite, React Router, TanStack Query, Zustand, Axios(JWT 인터셉터), wavesurfer, Tailwind v4 + shadcn/ui(Radix), Framer Motion(`motion`), Lucide, Inter (PRD §3)
- **디자인 시스템 §10.1 전부**: 프리미엄 다크 기본, 팔레트(#090909/#161616/#5B8CFF, red=오류·녹음만), 모션 원칙, MicButton = Siri급 인터랙션
- 게스트 검색 허용 + 저장/공유에서 로그인 유도 (권한 정책 §5.3)
- 모바일 우선·한 손 UX, 스켈레톤 로딩, 접근성(마이크 권한 실패 메시지 v2 계승)
- 화면 구성 계획(§6) — 단 Bottom Nav·미니 플레이어는 **M3 이후로 시점 명확화** (M2 범위 아님)
- 지문 결과 score 숨김 / 허밍만 일치율 노출 (현행 유지 확정)

---

## 3. Q3 OKR과 프론트 책임

> O: 처음 방문한 게스트가 30초 안에 흥얼거린 곡을 찾아내는, 신뢰할 수 있는 검색 경험 (안 A 확정)

**30초 예산 분해(지문, C1 채택 시)**: 권한 ~2s + 녹음 12s + 인식 ≤6s(KR2) + 결과 스캔 ~5s = **~25s**

| KR | 프론트 책임 |
|---|---|
| KR1 매칭률 | 녹음 품질 확보(사전 검증 C7로 분모 오염 방지), webm/opus 포맷 유지(다운샘플링은 타이밍 로그 확인 후) |
| KR2 p95 ≤6초 | `client_ms`(녹음 종료→렌더 완료) 계측·이벤트 첨부, 업로드 크기 관리 |
| KR3 완료율 ≥70% | 이벤트 4종 발화 누락 0 (C5), visit 세션당 1회 보장 |

---

## 4. 검색 UX 명세 (M2)

### 4.1 모드별 플로우 (C1 — D1·D2 확정)

| | 지문 (음악 찾기) | 허밍 (직접 부르기) |
|---|---|---|
| 녹음 종료 | **12초 자동 종료** — 카운트다운 링 표시, 조기 수동 정지 허용 | 수동 정지, **최대 20초 컷** |
| 검색 시점 | 정지 **즉시 자동 검색** (Shazam 패턴) | 재생 카드로 확인 후 **수동 [검색]** (현행 유지) |
| 근거 | 주변 음악은 재생해볼 이유가 없음 — 확인 단계는 순수 마찰 | 내 목소리는 확인·재녹음 욕구 실재(원키로 다시 부르기 등) |

- 재생 카드는 자동 검색 후에도 유지 → 실패 시 "같은 녹음으로 재검색"·"다시 녹음" 선택지 확보

### 4.2 업로드 전 사전 검증 (C7 — F1 선차단)

- 최소 길이: 지문 3초 / 허밍 8초 미만 → 업로드하지 않고 경고
- RMS(음량) 체크: 무음에 가까우면 업로드하지 않고 F1 화면
- 통과 시에만 multipart 업로드 → 서버 비용 0으로 실패 예방 + KR1 분모 오염 방지

---

## 5. 결과 화면 명세 (M2)

**카드 구성** (기존 `SearchResultsList.tsx` 확장)
- 좌측: **56px 라운드 정사각 이미지** — `cover_url` 렌더, `onError` 1차 → `https://i.ytimg.com/vi/{youtube_video_id}/mqdefault.jpg`, 2차 → 음표 아이콘 플레이스홀더. 스켈레톤에도 이미지 자리 추가
- 중앙: 제목 + (지문: 아티스트·앨범·연도 / 허밍: 일치율 %) — 현행 유지
- 우측: [듣기] = `youtube_url` 새 탭 (C8) + [즐겨찾기 ♡] (C6)
- **Top-3 고정** (C3): 지문은 보통 1건, 허밍은 최대 3건

**즐겨찾기 유도 시트 (C6, D4 확정)**
- 비로그인 클릭 → 바텀 시트: "로그인하면 이 곡을 저장할 수 있어요" + [로그인] CTA
- 클릭은 게스트→가입 전환 이벤트 원천으로 기록
- ✅**실저장 개통(2026-07-16, M3 착수)**: 로그인 상태 ♡ = 토글 — `POST /api/favorites {acrid}`(응답의 `music.id`로 해제 DELETE), 404(비동기 upsert 경합)면 1.5s 후 1회 재시도, 곡별 in-flight 가드로 연타 방지. 저장 시 하트 채움(`fill` + brand 색) + 토스트. 저장 상태는 화면 수명 동안 acrid 키로 유지
- ✅**목록 화면 개통(2026-07-16)**: `/favorites`(FavoritesPage) — 저장 최신순, 20개 페이지 "더 보기", 해제 즉시 반영(캐시 필터), 빈 상태 CTA(노래 찾으러 가기). 진입점: 홈 프로필 시트의 [즐겨찾기]. 비로그인 접근은 `/login`(next=/favorites)으로 — authStore `initialized` 플래그로 세션 하이드레이션 전 오판 방지. 계약: `GET /api/favorites` = PageResponse(snake_case: `items/page/size/total_items/total_pages`)

---

## 6. 실패 UX 명세 (M2 — 4유형, C4)

| # | 유형 | 감지 | 화면·카피 | CTA |
|---|---|---|---|---|
| F1 | 녹음 품질 불량 | **클라 사전 검증**(§4.2) — 서버 왕복 없음 | "소리가 거의 녹음되지 않았어요. 마이크를 가까이 하고 다시 시도해주세요" | [다시 녹음] |
| F2 | 무결과 | 서버 200 + 빈 배열 | 모드별 전환 제안 — 지문: "직접 불러보시겠어요?"(허밍 탭 유도) / 허밍: 팁("후렴구를 10초 이상") | [다시 녹음] · 탭 전환 |
| F3 | 저신뢰 (허밍 score<50) | 응답 score 판정 | 최고 1건 + "일치율이 낮지만…" (현행) | [다시 불러보기] 추가 |
| F4 | 오류 (네트워크/서버) | HTTP 오류·타임아웃 | "일시적인 문제가 발생했어요" — **raw 에러 메시지 노출 금지** | **[재시도] = 보존한 blob 재전송** (재녹음 불필요) |

- 우선순위: F1(실패 다수 예방) > F4(blob 보존 — 녹음 유실이 최악의 경험) > F2 > F3
- 모든 실패는 `search_failed(reason: bad_audio|no_match|low_score|error|timeout|cancelled)` 이벤트로 기록 → 실패 분포가 다음 개선 우선순위 결정
- 인식 요청은 **15초 타임아웃**(초과 시 F4 — blob 보존, 재시도 가능) + 검색 중 화면에 **[취소] 버튼**
- **취소는 즉시 실행하지 않고 확인 시트를 거친다**(하던 일을 실수로 날리지 않도록): ①녹음 중 취소(헤더) → 녹음 **일시정지**(MediaRecorder.pause, 자동정지·경과·무음검증 분모도 함께 정지) + 시트 → [계속 녹음하기]=이어서 녹음 / [그만두기]=폐기 후 홈 ②검색 중 [취소] → **요청은 유지**한 채 시트 → [계속 기다리기]=대기 지속(그 사이 결과 도착 시 시트 자동 닫힘) / [그만두기]=요청 중단(AbortController) 후 홈. 확정 취소만 `search_failed(reason: cancelled)` 기록

---

## 7. 이벤트 계측 명세 (M2 — C5)

**세션**: 앱 로드 시 UUID 생성 → `sessionStorage` 보관(탭 세션 = KR3 "방문" 단위) → 모든 요청에 `X-Session-Id` 헤더. IP·PII 없음.

**발화 규칙**: `POST /api/events`, fire-and-forget(실패해도 UX 영향 0, 재시도 안 함)

| event | 발화 시점 | properties |
|---|---|---|
| `visit` | 앱 로드, 세션당 1회 | `referrer`, `is_mobile` |
| `search_started` | 녹음 시작 | `mode` |
| `search_result_shown` | 결과 렌더 완료 | `mode`, `result_count`, `top_score`, `client_ms` |
| `search_failed` | F1·F4 등 클라 확정 실패 | `mode`, `reason`, `http_status` |
| `favorite_click` | 결과 카드 ♡ 클릭(로그인 여부 무관) | `mode`, `authed`, `acrid`, `rank`(결과 내 순위 0~), `score`, `action`(add\|remove\|login_prompt) — C6 게스트→가입 전환 + **매칭률 실측 원천**(사용자가 "내 곡"으로 집은 순위·점수) |
| `login_started` | 로그인 버튼 클릭(OAuth 리다이렉트 직전) | `provider` |
| `login_succeeded` | OAuth 복귀 후 세션 확인 시(sessionStorage pending 플래그로 판정) | `provider` |
| `login_failed` | 복귀 URL 에러 파라미터 감지 또는 즉시 실패 | `provider`, `reason`(cancelled\|error), `error_code` — 취소는 `cancelled`(SC-002 제외) |

서버가 직접 아는 것(검색 요청 타이밍, no_match)은 서버가 기록 — 프론트는 중복 발화하지 않는다.
로그인 계측(spec 001 FR-009)은 OAuth 전체 페이지 리다이렉트 특성상 시작 시 pending 플래그를 남기고 복귀 로드 시점에 성공/실패를 판정한다.

---

## 8. API 소비 계약 (backend-prd §6.1과 동일 유지)

**타입 확장** (`features/search/types.ts`)

```ts
export interface AcrResult {
  acrid?: string
  title?: string
  artists?: { name?: string }[]
  album?: { name?: string }
  release_date?: string
  score?: number            // 0~1, 허밍만 노출
  youtube_url?: string      // 듣기 버튼용 (watch?v= 파생값)
  youtube_video_id?: string // ★신규 — onError 썸네일 폴백용
  cover_url?: string        // ★신규 — 카드 이미지 (null 가능)
}
```

- 엔드포인트: `POST /api/search/fingerprint`·`/humming` (multipart `audio`), `POST /api/events`
- 오류 응답은 표준 바디 `{code, message, details}` — 화면에는 정제된 카피만, `message` 직접 렌더 금지 (F4)
- 인증: Supabase 세션 JWT를 Axios 인터셉터로 첨부(비로그인 시 생략 — 검색·이벤트는 인증 불요)

---

## 9. 화면 로드맵

| 시점 | 화면·요소 |
|---|---|
| **M2** | 홈/검색(플로우 개편 C1, 실패 UX, 결과 카드 C2·C3, 즐겨찾기 유도 C6), 이벤트 계측 |
| M3 | 로그인 화면 연결 강화, 플레이리스트 목록/상세, ✅즐겨찾기 목록(07-16), ✅검색 기록 화면(07-16 — `/history`, 목록 패턴은 즐겨찾기와 동일·no_match 행·허밍 일치율 배지·소유 삭제), **Bottom Navigation·미니 플레이어**, 인라인 재생 검토 |
| M4 | 커뮤니티(탐색)·리뷰 작성/수정·댓글, 프로필/설정 |
| M5+ | 자연어 검색 입력, 추천 피드 |

---

## 10. 디자인 시스템 (유지 — PRD §10.1 참조)

- 프리미엄 다크 기본 · 모바일 우선 · shadcn/ui 조합(직접 제작 최소화) · Framer Motion 마이크로 인터랙션
- 팔레트: bg `#090909` · surface `#161616` · accent `#5B8CFF` · red `#EF4444`(오류·녹음 중에만)
- M2 신규 요소도 동일 원칙: 카운트다운 링(지문 자동 종료), 유도 시트, 실패 화면 카피 톤 통일
- 결과 카드 이미지는 `rounded` + 스켈레톤 페이드인, 레이아웃 시프트 없도록 고정 크기(56px)

---

## 11. M2 Definition of Done — 프론트 항목 (brainstorming §6.6에서 분담)

1. 로컬 실기동에서 지문·허밍 각각 녹음→결과 표시 E2E 성공, **모바일 실기기 데모 1회 이상**
2. 실패 UX F1~F4가 정의된 화면·카피로 동작, raw 에러 노출 0건
3. 이벤트 4종 발화 확인(`event_log`에 실제 기록), `client_ms` 계측 동작
4. 결과 카드: Top-3 + 이미지 폴백 2단 동작(커버 없음·videoId 없음 케이스 포함)
5. 사전 검증(길이·RMS)이 업로드를 실제로 차단(F1 시나리오 수동 테스트)
6. 빌드(tsc + vite)·oxlint 통과
