# spec 004 로컬 테스트 가이드 — 웹검색 심층 탐색 (더 깊이 찾기)

mock E2E 검증용(T021·T023·T025). 외부 API 호출 없음(비용 0). ⚠️ 로컬 백엔드도 **실 Supabase DB**에 붙으므로 테스트 이벤트가 운영 event_log에 쌓인다 — 마지막 [정리](#6-%ED%85%8C%EC%8A%A4%ED%8A%B8-%ED%9B%84-%EC%A0%95%EB%A6%AC) 섹션 필수.

---

## 1. 사전 확인 (전부 이미 맞는 상태 — 보기만)

| 항목 | 위치 | 상태 |
| --- | --- | --- |
| 백엔드 키 | `backend\.env` | 기존 파일 그대로 (수정 불필요) |
| 프론트 API 주소 | `frontend\.env.local` | `VITE_API_BASE_URL=http://localhost:8080/api` ✅ |
| 프론트 자체 목업 | `frontend\src\mock\searchMock.ts` 12행 | `MOCK_SEARCH_ENABLED = false` ✅ (건드리지 말 것) |
| 시나리오 설정 | **파일 아님** — bootRun 실행하는 PowerShell 터미널의 `$env:` 변수 | 아래 명령에 포함 |

- 8080 고아 프로세스 확인(있으면 kill):

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
```

---

## 2. 기동

**터미널 1 — 백엔드** (`C:\workspace\Melolist-v3\backend`):

```powershell
Get-Content .env | ForEach-Object { if ($_ -match '^\s*([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process') } }
$env:SPRING_PROFILES_ACTIVE='acr-mock,ai-mock'
$env:ACR_MOCK_SCENARIO='nomatch'
$env:AI_MOCK_SCENARIO='hit'
$env:DEEP_MOCK_SCENARIO='hit'
.\gradlew.bat bootRun
```

기동 로그에 `★ 심층 탐색 MOCK 활성` 이 보이면 OK.

**터미널 2 — 프론트** (`C:\workspace\Melolist-v3\frontend`):

```powershell
npm run dev
```

→ http://localhost:5173

**시나리오 변경 방법**: 터미널 1에서 `Ctrl+C` → 바꿀 변수만 다시 설정 → `.\gradlew.bat bootRun`. 같은 터미널이면 `.env` 재주입 불필요. 터미널을 새로 열었으면 위 블록 전체를 다시 실행.

**마이크 팁**: acr-mock이라 실제 소리는 무관하지만 클라 사전검증(무음 차단)은 통과해야 함 — 마이크를 손으로 문질러 8초 이상 녹음하면 됨.

---

## 3. Run A — 기본 조합 (핵심 흐름)

설정: 위 기동 명령 그대로 (`nomatch` / `hit` / `hit`). **로그인 상태**로 시작.

- [x] **A1. 폴백 진입**: 허밍 검색(마찰음 8초+) → 실패 화면 → "말로 설명해서 찾기" → 아무 설명 입력 → AI 검색 → 후보 목록(좋은 날·Ditto) 표시

- [x] **A2. 확인 단계**: 목록 하단 "찾는 곡이 없나요? 더 깊이 찾기" 탭 → 질의가 미리 채워져 있고 수정 가능 / "오늘 남은 횟수 2/2회" / 30초 안내 표시

- [x] **A3. 실행·미확인 배지**: 실행 확정 → "웹에서 찾는 중… N초" 진행 화면 → 결과에 **좋은 날(배지 없음)** + **밤편지(미확인 배지 + 듣기 버튼)** 표시

- [x] **A4. 복귀(US2)**: "이전 결과로 돌아가기" → 원래 AI 후보 목록(좋은 날·Ditto)으로 복귀

- [x] **A5. 선택·저장**: 다시 진입 → 밤편지 선택 → "이 곡으로 확인했어요" 토스트 → ♡ → 즐겨찾기 저장 성공

- [x] **A6. 한도 소진(US3)**: 이제 2회 소진 상태 — 진입점 다시 탭 → 확인 단계 대신 **소진 안내 + 리셋 시각**("내일 0시…") / 일반 AI 검색은 계속 동작

- [x] **A7. 게스트 차단**: 로그아웃 → 같은 경로로 진입점 탭 → 로그인 페이지로 이동 → 로그인 완료 → 폴백 화면·질의가 복원됨

## 4. Run B\~D — 시나리오 변형 (각각 백엔드만 재시작)

### Run B — US1 진입점 (무결과 화면)

```powershell
$env:AI_MOCK_SCENARIO='empty'
```

- [x] 허밍 실패 → AI 검색 → **무결과 안내 화면에 "더 깊이 찾기" 버튼** 존재 확인 (A6에서 한도를 다 썼으면 눌렀을 때 소진 안내가 뜨는 게 정상 — 버튼 존재 확인이 목적)

### Run C — 진행·취소 (⚠️ 한도 필요 — 아래 리셋 SQL 먼저)

```powershell
$env:AI_MOCK_SCENARIO='hit'
$env:DEEP_MOCK_SCENARIO='slow'
```

한도 리셋(Supabase SQL Editor):

```sql
DELETE FROM event_log WHERE event_type = 'deep_search_request' AND created_at > '2026-08-04';
```

- [x] 심층 실행 → 진행 화면에서 경과 초 증가 확인 → **취소**→ 확인 단계로 복귀(질의 유지)

### Run D — 무결과·오류 안내

```powershell
$env:DEEP_MOCK_SCENARIO='empty'
```

- [x] 심층 실행 → "웹에서도 찾지 못했어요" + 단서 안내 표시

```powershell
$env:DEEP_MOCK_SCENARIO='error'
```

- [x] 심층 실행 → "심층 탐색이 잠시 원활하지 않아요" + "다시 시도" 표시

---

## 5. 이벤트 적재 확인 (Supabase SQL Editor)

```sql
select event_type, properties, created_at from event_log
 where event_type like 'deep_search_%' order by created_at desc limit 20;
```

- [x] `deep_search_open` — `from: ai_mismatch`(A2) / `ai_empty`(Run B)

- [x] `deep_search_request` — `web_ms/meta_ms/total_ms/candidates/unverified/outcome` 채워짐, A6의 거절 건은 `outcome: quota`

- [x] `deep_search_select` — `rank/ai_key/resolved/verified:false`(A5 밤편지)

- [x] `deep_search_cancel` — `elapsed_ms`(Run C)

---

## 6. 테스트 후 정리 (필수 — Claude는 DELETE가 차단되므로 직접 실행)

UI에서 밤편지 ♡ 해제 후:

```sql
-- 오늘 테스트 이벤트 전부
DELETE FROM event_log WHERE created_at > '2026-08-04';

-- mock 미확인 곡 행 (♡ 해제 안 했으면 favorite 먼저 지워야 FK 통과)
DELETE FROM music WHERE source = 'WEB' AND title = '밤편지';
```

백엔드 종료(`Ctrl+C`) 후 8080 고아 프로세스 확인:

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
```

---

## 7. 완료 후

전 항목 체크되면 Claude에게 알려주기 → 커밋 + PR 생성 진행. (선택) 실키 스모크 T029는 회당 \~80\~110원 × 2\~3쿼리 — 원하면 병합 전에 요청.