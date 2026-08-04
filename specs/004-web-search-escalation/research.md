# Phase 0 Research: 웹검색 심층 곡 탐색

**Date**: 2026-08-04 | **Feature**: [spec.md](./spec.md)

Technical Context에 NEEDS CLARIFICATION 없음. 아래는 2026-08-03 실측(웹검색 지연·단가)과
spec 002 구현 코드 분석으로 확정한 기술 결정이다.

## R1. 웹검색 클라이언트 — Responses API 직접 호출

- **Decision**: OpenAI **Responses API**(`POST /v1/responses`) + `tools:[{type:"web_search"}]`를
  Spring `RestClient`로 직접 호출하는 `OpenAiWebSongFinderClient`를 신설한다.
  모델 gpt-5.4-mini + reasoning_effort low(기존 폴백과 동일), 키·모델명은 기존
  `spring.ai.openai.*` 설정값을 주입받아 재사용한다.
- **Rationale**: Spring AI 1.1.8은 Chat Completions API 기반이라 web_search 도구를 못
  쓴다(08-03 조사 확정). `AiSongFinderClient`가 이미 인터페이스라 국소 추가가 가능하나,
  웹 후보는 **웹 근거 링크를 포함**해야 하므로 반환형이 다르다 → 별도 인터페이스
  `WebSongFinderClient`(반환 `WebSongCandidate`)로 분리한다(기존 폴백 경로 무변경).
- **Alternatives considered**: ①Spring AI 업그레이드 대기 — 시기 불명, 보류.
  ②기존 AiSongFinderClient 반환형 확장 — 002 경로 계약·테스트 21건에 파급, 기각.
  ③검색엔진 API(Google/Bing) + 별도 LLM 합성 — 구성요소 2배, 단가 이점 불명확, 기각.

## R2. 웹검색 발동 정책 — tool_choice auto + 프롬프트 유도

- **Decision**: `tool_choice`는 auto로 두고, 시스템 프롬프트에 "학습 지식으로 확신할 수
  없는 곡(최근 발매·희귀곡)은 반드시 웹 검색으로 확인하라"를 명시한다. 강제 발동은
  하지 않는다.
- **Rationale**: 실측(08-03)상 미발동 시 3~4s/~3원, 발동 시 19~21.5s/~80~110원.
  옛 곡 질의까지 강제 발동하면 비용·지연만 는다. 심층 탐색 진입 자체가 "일반 폴백이
  실패한 뒤"라 모델이 모르는 곡일 확률이 높고, auto라도 대부분 발동한다.
- **Alternatives considered**: `tool_choice:{type:"web_search"}` 강제 — 균일한 UX(항상
  느림)라는 장점보다 옛 곡 낭비 비용이 크다. 기각.

## R3. 시간 예산 분배 — 서버 22s+8s, 클라 35s, SC는 p95 30s

- **Decision**: 웹검색 LLM 호출 컷 **22s**(`melolist.ai.deep.timeout-ms`), 메타 대조는
  기존 소프트 데드라인 **8s**(`meta-deadline-ms` 재사용) → 서버 최악 ~30s.
  프론트 axios 하드 타임아웃 **35s**(전송·직렬화 여유). SC-003(p95 ≤ 30s)은 통계 목표,
  35s는 하드 컷(초과 시 F4 오류 패턴).
- **Rationale**: 발동 실측 최대 21.5s + 여유 0.5s = 22s. 메타 체인은 후보별 병렬이라
  전체는 웹호출+메타 순차 합(최악 30s). 30s를 하드 컷으로 쓰면 실측 상단(21.5s)+메타
  정상 체인(6.8~8.3s)이 겹칠 때 정상 요청이 잘린다 — 클라 컷은 35s로 분리.
- **Alternatives considered**: 웹호출·메타 오버랩(후보 스트리밍) — Responses API는 완료
  후 일괄 반환이라 불가. 메타 생략 — verified 라벨의 근거가 사라짐, 기각.

## R4. 미확인 라벨 — 필터를 라벨로 전환 + 웹 링크 수용

- **Decision**: 기존 3단 메타 대조 체인(원표기→원제목+로마자→영문 제목, 동명이곡
  아티스트 검증 포함)을 그대로 실행하되, 결과를 **제외 기준이 아닌 verified 플래그**로
  쓴다. verified=true면 카탈로그 videoId·커버가 정본(웹 링크 무시), false면 웹이
  찾아온 videoId를 표시·저장에 사용하고 커버는 ytimg 파생(`coverUrlOrFallback` 패턴).
- **Rationale**: 스펙 핵심 쟁점(신곡 오살 방지) + Clarifications Q1 확정(웹 링크
  표시·저장 허용). 카탈로그 확인이 성공하면 그쪽이 더 신뢰 가능(§5.2 정본 규칙 유지).
- **Alternatives considered**: 웹 링크를 verified 후보에도 우선 적용 — 카탈로그 정본
  규칙(C1) 위배 소지, 기각. 대조 자체 생략(전부 미확인) — 확인 가능한 곡까지 미확인
  처리해 신뢰 하락, 기각.

## R5. 웹 근거 videoId 검증 — §5.2 규칙 재사용

- **Decision**: LLM에는 "유튜브 링크(URL 또는 videoId)"를 후보 필드로 요구하고, 서버가
  URL에서 videoId를 추출·검증한다: youtube.com/watch·youtu.be·shorts 형식만 수용,
  ID는 `[A-Za-z0-9_-]{11}` 패턴, 불일치 시 null(후보는 링크 없는 미확인으로 유지).
- **Rationale**: 웹검색 근거가 있어도 모델이 URL을 오전사할 수 있다. 기존
  AcrMetadataHttpClient의 유튜브 도메인 검증 규칙(backend-prd §5.2)과 동일 기준을
  적용해 타 도메인 링크 유입을 차단한다(안전·정본 규칙 일관성).
- **Alternatives considered**: 링크 무검증 수용 — 임의 도메인 저장 위험, 기각.

## R6. 쿼터 — event_log 카운트 패턴 재사용, 사용자당 2회/일

- **Decision**: `deep_search_request` 이벤트를 카운트 원장으로 쓰는 기존 패턴 재사용 —
  `EventLogRepository.countByTypeAndUserSince`(outcome≠quota 제외 필터 내장, 타입
  파라미터라 무수정)로 Asia/Seoul 자정 리셋 2회/일(`melolist.ai.deep.user-daily`).
  `AiQuotaService`에 deep용 검사·잔여 조회 메서드를 추가한다. 로그인 전용이라 세션
  키 경로는 없다(무JWT는 SecurityConfig 401).
- **Rationale**: Render 재시작에 안전한 DB 카운트(002 R6 근거 동일). 접수 시점 집계
  (거절 제외)도 기존 의미 그대로. 잔여 횟수는 확인 단계 UI가 필요(FR-002) →
  `GET /api/search/deep/quota` 조회 엔드포인트 추가.
- **Alternatives considered**: 별도 quota 테이블 — 신규 테이블·마이그레이션 비용,
  이벤트 원장으로 충분, 기각.

## R7. 샘플링 — 1회 호출 (002의 2회 병렬 미적용)

- **Decision**: 웹검색 호출은 요청당 1회.
- **Rationale**: 002의 2회 샘플링은 리콜 변동(~80%) 보정용이고 회당 ~3원이라 가능했다.
  웹검색은 발동 시 ~80~110원으로 2배가 부담이며, 웹 근거 기반이라 순수 기억 인출보다
  변동이 작을 것으로 기대. 리콜 부족이 관측되면 후속에서 재검토(계측으로 판단 가능).
- **Alternatives considered**: 2회 병렬 — 회당 최대 ~220원, 쿼터 2회/일 취지와 충돌, 기각.

## R8. 선택·저장 — 별도 select 엔드포인트, ai-key 체계 공유

- **Decision**: `POST /api/search/deep/select` 신설(요청: candidate+verified+rank).
  acrid는 기존 `AiKeyGenerator.keyOf(title, artists)`(ai-key) 그대로 → music upsert
  `source="WEB"`, 검색 기록 `SearchHistory.Type.DEEP`, 이벤트 `deep_search_select`.
- **Rationale**: FR-007(기록 구분)과 이벤트 분리를 위해 text/select 재사용 대신 얇은
  전용 엔드포인트. ai-key 공유로 같은 곡을 일반 폴백/심층 어느 쪽으로 채택해도 **동일
  music 행에 수렴**한다(중복 방지). 이후 ♡·플레이리스트는 acrid=ai-key로 기존 계약
  무변경. Type·source는 varchar라 마이그레이션 불필요.
- **Alternatives considered**: text/select 재사용+origin 파라미터 — 기존 계약 개정이
  필요해 오히려 파급이 큼, 기각. 미확인 곡 전용 저장 정책 신설 — 기존 "링크 미해석 곡
  저장 허용" 정책으로 충분(스펙 Assumptions), 기각.

## R9. 계측 — deep_search_* 4종 (ai_search_* 패턴 미러)

- **Decision**:
  | type | 주체 | properties |
  |------|------|------------|
  | `deep_search_open` | 클라 | `{from: "ai_empty"\|"ai_mismatch"}` |
  | `deep_search_request` | 서버 | `{query_len, web_ms, meta_ms, total_ms, candidates, unverified, outcome: "hit"\|"empty"\|"error"\|"quota"}` |
  | `deep_search_select` | 서버 | `{rank, ai_key, resolved, verified}` |
  | `deep_search_cancel` | 클라 | `{elapsed_ms}` |
- **Rationale**: SC-001~005 산출에 필요한 원천 전부(시도율·채택률·미확인 비중·p95·
  한도 초과 0건 검증). 기존 ai_search_* 규약과 대칭이라 kr_metrics.sql 확장이 기계적.
  `deep_search_request`는 쿼터 카운트 원장을 겸한다(R6).
- **Alternatives considered**: ai_search_request에 tier 필드 추가 — 쿼터 카운트가
  섞여 002 한도가 오염됨, 기각.

## R10. 프론트 흐름 — 폴백 Phase 내부 단계 확장 + 게스트 유도 재사용

- **Decision**: 라우트 무변경. `FallbackSearchView`의 empty(무결과)·candidates(불만족)
  상태에 진입점을 넣고, 신규 `DeepSearchFlow` 컴포넌트가
  confirm(질의 프리필+잔여 횟수+소요 안내) → searching(진행+취소, 단계 문구
  "웹에서 찾는 중…") → candidates(미확인 배지)/empty/error/quota 단계를 관리한다.
  게스트는 진입점 탭 시 기존 로그인 유도 패턴(`navigate('/login', {state:{next}})` +
  세션 스태시 복원)을 재사용해 로그인 후 폴백 맥락으로 복귀한다.
- **Rationale**: 002가 확립한 "폴백은 /search/:mode 내부 Phase" 구조 유지(라우트·계약
  최소 파급). 미확인 배지는 verified=false 카드에만 붙어 기존 카드와 시각 구분(FR-005).
- **Alternatives considered**: 독립 라우트(/search/deep) — 복귀·스태시·가드 신규 비용,
  기각. FallbackSearchView 내 인라인 단계 추가 — 파일 비대(현 345행)·상태 조합 폭발,
  분리 컴포넌트로 결정.
