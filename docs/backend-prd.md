# Melolist-v3 Backend PRD (Spring Boot)

> **문서 상태:** v1.0 (2026-07-08) · 근거: `PRD.md`(마스터 v0.1) + `brainstorming.md`(0장 OKR · 6장 M2 설계 · 7장 이미지 소싱)
> **문서 위계:** `PRD.md` = 제품 전반(비전·화면·마일스톤 총괄). 본 문서 = **백엔드 실행 PRD** — 백엔드 책임 범위의 요구사항·계약·정책을 확정한다. 충돌 시 본 문서가 최신(브레인스토밍 결정 반영).
> **계약 동기화:** §6.1의 API 계약·이벤트 사전·에러 바디는 `frontend-prd.md` §8과 동일해야 하며, 변경 시 양쪽을 함께 갱신한다.

---

## 1. 역할과 경계

**백엔드(Spring Boot)가 하는 일**
- ACRCloud 연동 전담 (지문/허밍 identify + Metadata API 보강) — **API 키·서명은 서버에만 존재**
- 커버·유튜브 videoId 추출(폴백 체인 평가)과 `MUSIC` upsert(eager 캐시)
- Supabase JWT **검증**(JWKS, Resource Server) + `profiles` JIT 프로비저닝 + 앱 계층 인가
- 도메인 API 전체 제공(user/music/search/playlist/community/recommendation)
- 이벤트 수집(`/api/events`) + 검색 요청 타이밍 로그(KR2 원천)
- KR 측정: 매칭률 측정 스크립트, KR2·KR3 산출 SQL

**백엔드가 하지 않는 일**
- 로그인 플로우 자체(Supabase Auth가 담당, 프론트가 SDK로 수행) — 백엔드는 JWT 검증만
- 오디오 원본 저장(부록 A 확정 — 인식 후 즉시 폐기)
- 이미지 서빙: **커버/썸네일을 프록시·다운로드·재호스팅하지 않음** (URL 문자열만 저장, §9)
- 녹음·전처리·클라이언트 검증(프론트 담당)

---

## 2. 기존 PRD 대비 변경/유지 결정

### 2.1 변경 (brainstorming.md 반영)

| # | 항목 | 기존 PRD | 변경 | 근거 |
|---|---|---|---|---|
| C1 | MUSIC 스키마 | `youtube_url`, `thumbnail_url` | **`youtube_video_id`(정본) + `cover_url`**. `youtube_url`은 DB 저장하지 않고 DTO에서 파생(`https://www.youtube.com/watch?v={id}`) · `thumbnail_url` 폐기 · `preview_url` 저장 금지 | brainstorming §7.2·7.6 |
| C2 | 이벤트 수집 | "M6에 측정 도구, 초기엔 로깅" (선언만) | **M2에 구현 확정**: `event_log` 테이블 + `POST /api/events` + 이벤트 4종 + `search_request` 타이밍 레코드 | §6.4, OKR KR2·KR3 |
| C3 | 검색 응답 DTO | acrid·title·artists·album·score·youtube_url | + **`cover_url`, `youtube_video_id`** 추가 | §7.6 |
| C4 | SearchHistory | M2 산출물로 뭉뚱그림 | **M2는 write만**(로그인 사용자 한정), 조회 API(`GET /search/history`)·삭제는 M3 | §6.5 |
| C5 | 검색 파이프라인 계측 | 없음 | 요청당 구간별 타이밍(`total_ms/acr_ms/meta_ms/upsert_ms/audio_bytes/mode/matched`) 기록 의무화 | §6.4, KR2 |
| C6 | 매칭률 측정 | 없음 | backend에 측정 스크립트 추가(Top-3 판정, CI 무관 수동 실행) | §0 KR1 |
| C7 | 메타 보강 범위 | "유튜브 메타 보강" | 커버 추출 규칙 확정: `album.covers.medium` → ytimg 폴백 → null. external_metadata에서는 **`youtube[].id`만** 읽음(도메인 검증 포함) | §7.3 |
| C8 | 저작권 가드레일 | 없음 | 이미지 프록시·재호스팅 금지 / Apple preview 사용·저장 금지 / 핫링크 URL만 저장 | §7.2 |

### 2.2 유지 (변경 없음 — PRD.md가 계속 유효)

- 기술 스택: Java 21 + Spring Boot 3.5 + Spring Security(JWKS) + JPA 단일화 (PRD §3)
- Domain 중심 패키지 구조 8종 (PRD §4.2), DTO 계약·Entity 비노출·표준 에러 바디 `{code, message, details}` (PRD §4.3)
- 인가: **앱 계층 단독**(`@PreAuthorize` + 소유자 체크), RLS는 Storage 버킷만 (부록 A-2)
- eager 캐시 원칙: 인식 결과를 MUSIC에 upsert(acrid 기준), "담기"는 FK 참조만 (부록 A.1)
- 1인 1리뷰(user_id unique, 중복 작성 409), 리뷰 유예 `review_hide_until` (PRD §5·§7)
- 오디오 원본 미저장(`audio_path` 항상 null), Google+이메일 인증, 팔로우는 P2 슬롯만 (부록 A)
- MUSIC 외 엔티티(USER/SEARCH_HISTORY/PLAYLIST/PLAYLIST_MUSIC/FAVORITE/REVIEW/COMMENT/FOLLOW) 스키마 (PRD §8.2)

---

## 3. Q3 OKR과 백엔드 책임

> O: 처음 방문한 게스트가 30초 안에 흥얼거린 곡을 찾아내는, 신뢰할 수 있는 검색 경험 (안 A 확정)

| KR | 목표 | 백엔드 책임 |
|---|---|---|
| KR1 매칭률 | 지문 ≥80% · 허밍 ≥50% (Top-3) | ACRCloud 연동 품질(파라미터·포맷), 측정 스크립트 제공, 정답 판정(acrid/제목-아티스트) |
| KR2 응답 시간 | p95 ≤ 6초 | 구간별 타이밍 로그(C5), 병목 분해(업로드/ACR/메타/upsert), p95 산출 SQL |
| KR3 검색 완료율 | ≥ 70% | `event_log` 수집 경로 + 산출 SQL (`search_result_shown` 세션 ÷ `visit` 세션) |

⚠️ **허밍 스파이크(M2 첫 2주)**: ACRCloud 허밍 성능 판정 + §7.4 실측 항목(identify 응답의 external_metadata, 커버 커버리지, ACRCloud 약관, 핫링크) 겸행. 결과에 따라 KR1 허밍 목표와 Metadata API 호출 전략을 조정한다.

---

## 4. 도메인 구조 (유지)

```
com.melolist
├─ auth          # Supabase JWT 검증 필터, JIT 프로비저닝, 인가
├─ user          # 프로필, review_hide_until
├─ music         # MUSIC 캐시, 곡 조회/텍스트 검색(로컬 캐시 대상)
├─ search        # ★M2: 지문/허밍 검색, ACRCloud 클라이언트, 메타 보강, SearchHistory
├─ playlist      # M3
├─ community     # M4 (리뷰·댓글·즐겨찾기·공유)
├─ recommendation# M5 슬롯
└─ common        # 예외·표준응답·설정·외부클라이언트 + ★event(이벤트 수집)
```

이벤트 수집은 특정 도메인 소유가 아니므로 `common`(또는 최상위 `event` 패키지)에 둔다.

---

## 5. M2 검색 파이프라인 (핵심 신규 설계)

### 5.1 처리 순서 — `POST /api/search/{fingerprint|humming}`

```
multipart(audio) 수신
 → [t0] 기본 검증 (크기 상한, MIME)
 → [acr_ms] ACRCloud identify (서명 요청)
 → 결과 0건이면: 200 + 빈 배열 (F2) — 기록(search_request matched=false·search_failed)은 비동기 후처리
 → 상위 최대 3곡 확정 (Top-3)
 → [meta_ms] 메타 보강: Metadata API 조회 (허밍 Top-3는 병렬, score≤0.5는 생략)
     └ 커버·videoId 추출 (§5.2)
 → 200 + AcrResult[] (§6.1) — 응답은 여기서 종료
 ─┄ 비동기 후처리 (응답 경로에서 분리, 2026-07-14 실측 후 확정) ┄─
 → [upsert_ms] MUSIC upsert (acrid 기준; 동시 acrid 경합은 재조회 수렴)
 → SearchHistory write (JWT 있을 때만; 실패해도 기록 유실만 로그)
 → search_request 타이밍 레코드 기록 (total_ms = 응답 경로만, upsert_ms는 비동기 측정치)
```

### 5.2 커버·유튜브 추출 규칙 (brainstorming §7.3 확정)

1. `cover_url` = `album.covers.medium` (최상위 필드, 플랫폼 배열 파싱 없음)
2. 없으면 `cover_url` = `https://i.ytimg.com/vi/{videoId}/mqdefault.jpg`
3. 둘 다 없으면 `cover_url` = null (플레이스홀더는 프론트 책임)

- `youtube_video_id` = `external_metadata.youtube[].id` — **external_metadata에서 읽는 유일한 필드**. link의 도메인이 youtube 계열인지 검증 후 사용(§7.1-5 오염 사례 대비)
- applemusic/deezer/spotify 배열은 파싱하지 않음. `preview`는 읽지도 저장하지도 않음(§9)
- 조회 query의 `artists`는 **배열**(`{"track":"...","artists":["..."]}`) — 문자열로 보내면 API가 대부분 `data:[]`를 반환한다(2026-07-16 실측: 문자열 형식에서 19곡 중 1곡만 매칭, 배열 전환 후 동일 곡들 매칭)

### 5.3 성능 예산 (KR2 ≤ 6초)

| 통제 수단 | 내용 |
|---|---|
| eager 캐시 | 같은 acrid 재검색 시 MUSIC 캐시 히트 → meta_ms = 0 |
| 병렬화 | 허밍 Top-3 메타 조회 3건 병렬 |
| 보강 생략 | score ≤ 0.5 결과는 메타 보강 생략 |
| 비동기 upsert | ✅ 적용(2026-07-14) — 실측 upsert_ms 평균 0.8s·최대 2.5s(허밍) 확인 후 upsert·검색기록·계측 기록을 응답 경로에서 분리. KR2의 `total_ms`는 이제 응답 경로만 계측 |
| meta 타임아웃 4s | ✅ 조정(2026-07-16, 3s→4s) — 타임아웃 시 videoId까지 잃어 듣기 버튼·ytimg 폴백이 모두 사라진다(3s 컷의 전제 오류). 실측 정상 조회 2.4~3.6s를 커버하면서 KR2 예산(acr ~1.5s + meta 4s ≈ 5.5s) 안 |
| 클라 타임아웃 15s | 프론트 인식 요청 15s 컷 + 검색 중 [취소] 버튼(frontend-prd 참조) — 파이프라인이 아닌 최악 대기의 상한 |

---

## 6. API 설계

### 6.1 M2 계약 (프론트와 공유 — frontend-prd §8과 동일 유지)

**`POST /api/search/fingerprint` · `POST /api/search/humming`** — 인증 불요, multipart `audio`

```jsonc
// 200 응답
{
  "results": [
    {
      "acrid": "…",
      "title": "Blank Space",
      "artists": [{ "name": "Taylor Swift" }],
      "album": { "name": "…" },
      "release_date": "2014-01-01",
      "score": 0.92,                          // 허밍만 의미. 지문은 노출 안 함(프론트 규칙)
      "youtube_video_id": "dC9QIUKviJU",      // null 가능
      "youtube_url": "https://www.youtube.com/watch?v=dC9QIUKviJU",  // videoId에서 파생, null 가능
      "cover_url": "https://…/300x300bb.jpg"  // null 가능 → 프론트 플레이스홀더
    }
  ]
}
// 무결과(F2): 200 + { "results": [] }
// 오류(F4): 표준 에러 바디 { "code", "message", "details" } — raw 예외 메시지 금지
```

**`POST /api/events`** — 인증 불요, fire-and-forget (실패 무시 가능), 응답 204

```jsonc
// 요청 헤더: X-Session-Id: <uuid>   (프론트 생성, sessionStorage 보관)
// 요청 바디
{ "type": "visit", "properties": { "referrer": "…", "is_mobile": true } }
// user_id는 JWT가 있으면 서버가 채움. IP는 저장하지 않음(게스트 PII 없음)
```

**이벤트 사전 (M2 + spec 001 로그인 계측)**

| type | 기록 주체 | properties |
|---|---|---|
| `visit` | 프론트 | `referrer`, `is_mobile` |
| `search_started` | 프론트 | `mode` |
| `search_result_shown` | 프론트 | `mode`, `result_count`, `top_score`, `client_ms` |
| `search_failed` | 프론트(F1·F4·렌더 실패·타임아웃·취소) / 서버(no_match 등 직접 아는 것) | `mode`, `reason`(bad_audio\|no_match\|low_score\|error\|timeout\|cancelled), `http_status` |
| `search_request` | **서버 전용** (검색 처리 중 직접 기록) | `total_ms`, `acr_ms`, `meta_ms`, `upsert_ms`, `audio_bytes`, `mode`, `matched` |
| `favorite_click` | 프론트 | `mode`, `authed`, `acrid`, `rank`(결과 내 순위 0~), `score`, `action`(add\|remove\|login_prompt) — C6 게스트→가입 전환 + **매칭률 실측 원천**(사용자가 "내 곡"으로 집은 순위·점수) |
| `login_started` | 프론트 | `provider` — 로그인 버튼 클릭(OAuth 리다이렉트 직전) |
| `login_succeeded` | 프론트 | `provider` — OAuth 복귀 후 세션 확인 시 |
| `login_failed` | 프론트 | `provider`, `reason`(cancelled\|error), `error_code` — 사용자 취소는 `cancelled`(SC-002 산출 시 제외) |

### 6.2 전체 API — 마일스톤 매핑 (경로·의미는 PRD §7 유지)

| 도메인 | 엔드포인트 | 시점 |
|---|---|---|
| user | `GET/PATCH /users/me`, `GET /users/{id}`, `PATCH /users/me/review-visibility` | M1(me)·M4(리뷰유예) |
| search | `POST /search/fingerprint`·`/humming` | **M2** |
| event | `POST /events` | **M2 (신설)** |
| search | `GET /search/history`, `DELETE /search/history/{id}` | M3 (write는 M2) |
| music | `GET /music/{id}`, `GET /music?query=` (로컬 캐시 검색) | M3 |
| playlist | CRUD + tracks + reorder | M3 |
| community | reviews(1인1건·409)/favorites/comments/공개 탐색 | ✅M3 favorites 실저장 개통(2026-07-16) — `POST /favorites`는 `music_id` **또는 `acrid`**(검색 결과 화면엔 musicId가 없음 — upsert 비동기라 404 시 클라 1회 재시도) 수용, 저장 행(`{id, music, created_at}`)을 반환(해제 DELETE에 music.id 사용). 나머지는 M4 |
| recommendation | `/recommendations/*`, `/ai/chat`, `POST /search/text` | M5 |

---

## 7. DB 설계

### 7.1 MUSIC (개정 — C1)

| 컬럼 | 타입 | 제약 | 비고 |
|---|---|---|---|
| id | bigint | PK | |
| acrid | varchar(64) | unique, null | upsert 키 |
| title | varchar(255) | | |
| artist | varchar(255) | null | |
| album | varchar(255) | null | |
| release_date | date | null | |
| **youtube_video_id** | varchar(20) | null | **재생 정본** — youtube_url은 DTO 파생 |
| **cover_url** | text | null | 핫링크 URL만 (§9) |
| duration_ms | int | null | |
| source | varchar(20) | | 'ACRCLOUD' |
| created_at / updated_at | timestamptz | | |

> 개정 사항: `thumbnail_url`·`youtube_url` 컬럼 제거, `preview_url` 추가하지 않음. 부록 A.1의 "youtube_url이 재생 핵심 필드"는 "**youtube_video_id가 재생 정본**"으로 읽는다(파생 URL은 결정적이므로 정보 손실 없음).

### 7.2 event_log (신설 — C2, brainstorming §6.4)

```sql
create table event_log (
  id          bigint generated always as identity primary key,
  event_type  text not null,
  session_id  uuid not null,
  user_id     uuid,
  properties  jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index on event_log (event_type, created_at);
```

- `search_request` 타이밍도 같은 테이블에 `event_type='search_request'`로 시작(단순 우선), 쿼리가 불편해지면 분리
- SearchHistory(도메인 데이터, 로그인 사용자의 "내 기록")와 event_log(익명 계측)는 **역할이 달라 분리 유지**

### 7.3 유지 엔티티

USER(profiles) · SEARCH_HISTORY · PLAYLIST · PLAYLIST_MUSIC · FAVORITE · REVIEW · COMMENT · FOLLOW — PRD §8.2 그대로. SEARCH_HISTORY.audio_path는 항상 null(오디오 미저장).

---

## 8. 실패·에러 처리 (서버 측)

| 유형 | 서버 동작 |
|---|---|
| F2 무결과 | 200 + 빈 배열 (에러 아님). `search_request(matched=false)` 기록 |
| F3 저신뢰(허밍) | score 그대로 반환 — 노출 판단은 프론트 규칙 |
| F4 오류 | 표준 에러 바디 `{code, message, details}`. **ACRCloud raw 에러·스택을 그대로 담지 않음**. ACRCloud 호출에 타임아웃 설정 |
| 업로드 이상 | 크기 상한 초과·비오디오 MIME → 400 + 표준 바디 (F1의 길이/RMS 검증은 프론트 선차단이 1차 방어) |

---

## 9. 보안·데이터 정책 (가드레일)

1. **이미지 프록시·재호스팅 금지** — cover_url 문자열만 저장, 이미지 바이트를 다운로드·캐싱·서빙하지 않는다 (저작권 등급 상승 방지, brainstorming §7.2)
2. **Apple preview 사용·저장 금지** — M3 인라인 재생 논의 시 약관 확인 후 재론
3. **오디오 원본 미저장** — 인식 처리 후 즉시 폐기, 디스크에 쓰지 않음
4. **게스트 PII 없음** — session_id(UUID)만, IP 저장 안 함
5. ACRCloud 키·서명은 서버 전용(환경변수), 프론트에 노출 금지
6. 인증 불요 엔드포인트 명시 관리: `/search/*`(M2 2종), `/events`, 공개 조회 계열 — SecurityFilterChain에 화이트리스트로 선언

---

## 10. 측정

- **매칭률 스크립트** (backend 내, 수동 실행): 테스트 곡 셋(지문 30 + 허밍 20)을 `/api/search/*`에 투입 → Top-3 내 acrid/제목-아티스트 일치 판정 → 분기 중 3회 이상 실행(M2 중간·완료·분기 말) — ✅**`backend/scripts/match-rate/`**(2026-07-16, Node 의존성 0). manifest에 곡 셋 기입, 오디오·리포트·실측 manifest는 gitignore(원칙 IV). acr-mock 스모크 통과 — **실측은 테스트 곡 셋 오디오 준비 후**
- **KR 산출 SQL**: KR2 = `search_request.total_ms`의 p95 · KR3 = 기간 내 distinct `search_result_shown` 세션 ÷ `visit` 세션 — ✅**`backend/db/queries/kr_metrics.sql`**(2026-07-16, KR2 모드별/구간 분해/주간 추이/실패 분포 포함). 첫 산출: 07-14 최적화 이후 허밍 p95 **5,708ms 통과**(n=10, 직전 12.4s), KR3 24%(베타 전 — 개발 테스트 세션 오염 참고치)
- 헬스 메트릭(전환율·리뷰율·재방문율)은 M3/M4 기능 추가 시점부터 이벤트 원천만 수집

---

## 11. M2 Definition of Done — 백엔드 항목 (brainstorming §6.6에서 분담)

1. 지문·허밍 검색이 로컬 실기동(Supabase 연결)에서 E2E 응답 — 프론트와 합동 확인
2. 매칭률 1차 측정 완료(스크립트 동작) — 지문 ≥80%, 허밍은 스파이크 판정 반영 기준
3. 타이밍 로그 동작 + p95 산출 SQL이 값을 반환. ≤6초 미달 시 병목 구간 식별까지 M2 내 완료
4. 이벤트 4종 + `search_request`가 실제 기록됨
5. search 도메인 단위+통합 테스트(ACRCloud mock) CI 통과
6. API 계약(§6.1) 문서와 실제 응답 일치, raw 에러 노출 0건
