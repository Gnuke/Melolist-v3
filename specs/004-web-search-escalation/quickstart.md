# Quickstart: 웹검색 심층 곡 탐색 검증 가이드

**Date**: 2026-08-04 | **Feature**: [spec.md](./spec.md) |
계약: [contracts/search-deep-api.md](./contracts/search-deep-api.md) ·
데이터: [data-model.md](./data-model.md)

## 사전 조건

- JDK 21 (Gradle toolchain 자동 감지), Node 20+
- `backend/.env` (미추적) — mock 검증에는 OPENAI 키 불필요, 실키 스모크에만 필요
- Windows 주의: 이전 bootRun 고아 프로세스가 8080 점유 가능 —
  `Get-NetTCPConnection -LocalPort 8080`으로 확인 후 kill

## 1. Mock E2E (외부 호출 0 — FR-011, 병합 게이트)

백엔드 (acr-mock + ai-mock 프로파일, 시나리오는 env로 전환):

```powershell
# backend/ 에서 — DEEP_MOCK_SCENARIO: hit | unverified | empty | error | slow
$env:SPRING_PROFILES_ACTIVE="acr-mock,ai-mock"; $env:DEEP_MOCK_SCENARIO="hit"
./gradlew bootRun
```

프론트 (`frontend/`): `MOCK_SEARCH_ENABLED=false` 확인 후 `npm run dev` → localhost:5173

검증 시나리오 (US 매핑):

| # | 시나리오 | 절차 | 기대 결과 |
|---|----------|------|-----------|
| 1 | US1 진입·확인 단계 | 로그인 → 허밍 mock 실패 → AI 폴백 무결과 → "더 깊이 찾기" | 확인 단계: 질의 프리필·수정 가능·잔여 횟수(2회)·소요 안내 표시 |
| 2 | US1 후보·미확인 배지 | `DEEP_MOCK_SCENARIO=unverified`로 실행 확정 | verified 후보는 기존 카드와 동일, false 후보만 "미확인" 배지 + 웹 링크 듣기 버튼 |
| 3 | US1 선택·저장 | 미확인 후보 선택 → ♡ | select 200, music에 source=WEB 행, ♡ 정상(acrid=ai-key) |
| 4 | US2 불만족 진입·복귀 | AI 폴백 후보 화면 → "찾는 곡이 없나요?" → 결과에서 "이전 결과로" | 심층 결과 ↔ 원래 AI 폴백 후보 목록 왕복 |
| 5 | US3 한도 소진 | 2회 실행 후 3회째 진입 | 429 → 소진 안내 + 리셋 시각, 일반 AI 폴백은 계속 동작 |
| 6 | 게스트 차단 | 로그아웃 → 진입점 탭 | 로그인 유도 → 로그인 후 폴백 맥락 복귀 (직접 API는 401) |
| 7 | 진행·취소 | `DEEP_MOCK_SCENARIO=slow`로 실행 → 취소 | 진행 표시("웹에서 찾는 중…") → 취소 시 진입 전 화면, deep_search_cancel 기록 |
| 8 | 무후보·오류 | `empty` / `error` 시나리오 | 단서 보완 안내(입력 유지) / F4 오류 + 재시도 |

이벤트 검증 (Supabase SQL — mock 세션은 실백엔드라 event_log에 남는다):

```sql
select event_type, properties, created_at from event_log
 where event_type like 'deep_search_%' order by created_at desc limit 20;
-- 기대: open(from)·request(web_ms/meta_ms/total_ms/candidates/unverified/outcome)·
--       select(rank/ai_key/resolved/verified)·cancel(elapsed_ms)
```

## 2. 백엔드 단위 테스트 (병합 게이트)

```powershell
./gradlew -p backend test   # 기존 83건 + DeepSearchService/CandidateMetaVerifier/클라이언트 신규 — 전부 GREEN
```

핵심 커버: 쿼터(2회/일·리셋·거절 시 outcome=quota 기록), verified 라벨링(필터 아님 —
전부 미확인이어도 후보 유지), 웹 videoId 검증(11자 패턴·비유튜브 거부), ai-key 검증
불일치 400, **TextSearchService 기존 21건 무변화**(CandidateMetaVerifier 추출 수용 기준).

## 3. 실키 스모크 (로컬, 선택 — 운영 반영 전 1회)

```powershell
# backend/.env의 OPENAI_API_KEY 필요. 비용: 발동 시 회당 ~80~110원 — 2~3쿼리로 제한
$env:SPRING_PROFILES_ACTIVE="acr-mock"   # ACR만 mock, AI·웹검색은 실호출
./gradlew bootRun
```

- 신곡 질의(최근 1~2개월 발매곡 묘사) → 웹검색 발동 확인(web_ms 15s+), 미확인 후보에
  웹 videoId 부착 여부, 30s 내 응답.
- 옛 곡 질의 → 미발동 경로(web_ms 3~4s)도 정상 hit.
- 한글 질의 curl은 Git Bash 인코딩이 깨진다 — **Node 스크립트로 호출**(002 확립 패턴).

## 4. 운영 스모크 (배포 후)

1. Render 웜업(`/actuator/health` UP 확인 — 콜드스타트 중 테스트 금지, 이벤트 유실).
2. 실계정 로그인 → 심층 탐색 1회(쿼터 소모 유의) → 후보·배지·선택·♡ 확인.
3. 위 SQL로 운영 event_log 적재 확인 → 테스트 이벤트는 세션 ID 기준 정리 SQL 실행
   (사용자 몫 — 분류기 차단).

## 예상 결과 요약 (Definition of Done 연결)

- 병합 게이트: build + 전체 테스트 GREEN + mock 시나리오 1~8 통과 (constitution VI).
- 계약 동기화: backend-prd §6.1·frontend-prd §8에 계약 문서 반영 커밋 포함 (원칙 II).
- SC 검증: SC-003/004/005는 위 SQL로 즉시 산출 가능, SC-001/002는 운영 데이터 축적 후.
