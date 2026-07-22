# Research: AI 자연어 폴백 검색

**Date**: 2026-07-21 | **Plan**: [plan.md](./plan.md)

스펙의 미확정 사항과 기술 선택을 결정한다. 모든 항목은 Decision / Rationale /
Alternatives considered 형식.

---

## R1. AI 제공자·모델

**Decision**: OpenAI `gpt-5-mini` (Chat Completions). 모델명은
`melolist.ai.model=${AI_MODEL:gpt-5-mini}`로 바인딩해 env 교체 가능하게 한다.

**Rationale**: 사용자 확정 사항(OpenAI + Spring AI). gpt-5-mini는 지식 컷오프가
최신이고 다국어(한국곡) 지식이 강해 채택률 목표(SC-002 40%)에 유리하면서 쿼리당
약 1~2원 수준(입력 ~700 + 출력 ~400토큰 기준)으로 비용이 무시 가능하다.
추론(reasoning) 강도는 최소로 설정한다 — 곡 식별은 지식 인출 작업이라 깊은 추론이
불필요하고 지연만 늘린다.

**Alternatives considered**:
- `gpt-4o-mini` — 최저가지만 지식 컷오프가 오래돼 최신곡·한국곡 식별률 열세. 비용 차이가 쿼리당 1원 미만이라 절감 의미 없음.
- `gpt-5` — 품질 최상이나 쿼리당 7~15원 + 지연 증가. 베타 규모에서 과함. 채택률 미달 시 env 교체로 승격 가능.
- Claude/Gemini — 사용자가 OpenAI로 확정. Spring AI는 제공자 추상화가 있어 향후 교체 여지는 남음.

> 단가는 계획 시점 지식 기반 추정치 — 구현 태스크에서 OpenAI 공식 pricing 페이지로 재확인한다.

## R2. 호출 스택 — Spring AI

**Decision**: Spring AI BOM(구현 시점 최신 안정판, 1.1.x 계열) +
`spring-ai-starter-model-openai`. `ChatClient` + 구조화 출력(`entity()` 바인딩,
후보 목록 record)으로 JSON 후보를 받는다. build.gradle에 `dependencyManagement`
블록 신설(현재 BOM import 없음 — mavenCentral로 충분, GA부터 Central 배포).

**Rationale**: 사용자 확정 사항. PRD가 Java 21 선정 근거로 "Spring AI(M5) 대비"를
명시해 프로젝트 방향과 정합. ChatClient 구조화 출력은 후보 JSON 파싱·검증 코드를
직접 짜지 않게 해준다. 키 바인딩은 `spring.ai.openai.api-key=${OPENAI_API_KEY:}` —
기존 ACRCloud env 패턴과 동일하게 .env(미추적) 주입.

**Alternatives considered**:
- OpenAI 공식 Java SDK 직접 사용 — 의존은 가볍지만 구조화 출력·재시도·옵션 바인딩을 수작업. Spring AI가 프로젝트 로드맵(M5 추천)과 겹쳐 학습 투자 가치가 더 큼.
- WebClient 수제 호출 — 유지보수 비용 대비 이점 없음.

> 구현 시 확인 사항: (1) Spring AI 안정판 버전 고정, (2) gpt-5 계열 reasoning 옵션의 Spring AI 노출 여부(미지원이면 기본값 사용 — 동작에는 지장 없음), (3) 구조화 출력이 gpt-5-mini에서 json_schema 모드로 동작하는지.

## R3. 웹 검색 보강 — MVP 미사용

**Decision**: MVP는 모델 지식 기반 식별만 사용. 웹 검색 보강은 후속 확장.

**Rationale**: 웹 검색은 OpenAI 쪽 별도 API 표면(검색 전용 모델/Responses API)에
묶여 있어 Spring AI 지원 확인·지연 증가(+수 초)·검색 과금이 따라온다. 인기곡·한국곡
식별은 모델 지식으로 충분히 시작 가능하고, SC-002(채택률 40%)가 미달일 때 근거를
갖고 추가하는 것이 순서다. 발매 수개월 이내 최신곡 미식별은 알려진 한계로 수용
(무후보 안내 + 단서 보완 UX가 흡수).

**Alternatives considered**: 검색 보강을 처음부터 탑재 — 채택률 데이터 없이 복잡도·
지연·비용을 선지불하는 셈이라 기각.

## R4. 후보 메타 해석(videoId·커버) — 기존 클라이언트 재사용

**Decision**: LLM은 **제목·아티스트 텍스트만** 반환하고, youtube_video_id·cover_url은
기존 `AcrMetadataClient.lookup(track, artist, mode)`로 후보별 병렬 해석한다(가상
스레드, 기존 enrich 패턴). 해석 실패 후보는 링크 없이 표시(FR-004, 기존 "링크
미해석 곡 허용" 정책과 동일). 커버는 기존 `resolveCoverUrl` 3단 폴백 재사용.

**Rationale**: 시그니처가 이미 곡명·아티스트 기반이라 무변경 재사용 가능. 신규 외부
의존·키·쿼터가 0. 검증 효과도 있음 — 메타 해석에 실패한 후보는 환각일 가능성이
높다는 신호로 활용(순위 하향).

**Alternatives considered**:
- YouTube Data API — videoId 정확도는 높지만 신규 키·일일 쿼터(search 100회/일 무료) 관리 부담. 기존 클라이언트로 충분.
- LLM에 videoId 직접 요청 — videoId는 환각이 흔한 대표 사례. 기각.

## R5. 후보 저장 전략 — 선택 시 지연 저장(lazy persist)

**Decision**: 후보 5곡은 응답 DTO로만 반환하고 저장하지 않는다. 사용자가 후보를
**선택한 시점**에 `POST /api/search/text/select`로 그 1곡만 upsert한다.
- dedup 키: `ai-<sha256(정규화(제목)|정규화(아티스트)) 앞 16 hex>` (19자, acrid 컬럼
  length 64에 수용)를 acrid 컬럼에 저장 — 기존 `findByAcrid` dedup과 즐겨찾기
  계약(acrid 수용)이 무변경 동작. 정규화 = 소문자화 + 연속 공백 축약 + 앞뒤 공백 제거.
- `source='AI'` 전달(`MusicUpsertCommand`에 source 필드 추가, 기존 경로 기본값
  ACRCLOUD 유지).
- select는 게스트도 호출 가능(permitAll) — upsert는 항상 수행하고, search_history
  (Type.TEXT, MATCHED) 기록은 JWT 있을 때만.

**Rationale**: (1) 환각 곡이 DB에 쌓이는 것 방지 — ACR top-3 자동 upsert와 달리 AI
후보는 실존 보장이 없다. (2) spec FR-006("채택한 곡만 기록")과 정합. (3) 게스트도
upsert하는 이유: 게스트가 ♡ → 로그인 유도 → 로그인 후 즐겨찾기 저장 흐름에서 곡
row가 이미 존재해야 하기 때문. (4) acrid 컬럼 재사용으로 스키마 마이그레이션 0.

**Alternatives considered**:
- 응답 즉시 5곡 전부 upsert(기존 ACR 방식과 동일) — 환각 곡 오염 + FR-006과 어긋남. 기각.
- (제목, 아티스트) unique 인덱스 신설 — 마이그레이션 + 즐겨찾기 계약 변경(music_id 수용) 파급. ai-key 방식이 더 작음. 기각.
- ACR·AI 중복 수렴(같은 곡이 두 소스로 두 row) — 알려진 한계로 수용. 후속에 title/artist 백필 병합 검토(quickstart 비고에 기록).

## R6. 일일 이용 한도 — event_log 카운트

**Decision**: 게스트 3회/일(세션 UUID 기준) · 로그인 10회/일(user_id 기준).
`event_log`에서 `type='ai_search_request'`를 당일 범위로 카운트해 요청 진입 시
검사한다. 날짜 경계는 **Asia/Seoul 자정**. 초과 시 429 + 표준 바디
`{code:"AI_QUOTA_EXCEEDED", details:{limit, reset_at}}`. 한도 값은
`melolist.ai.quota.guest-daily`/`user-daily`로 바인딩(env 조정 가능).

**Rationale**: 사용자 확정 수치. 별도 인프라 없이 기존 계측 원천을 판정에 재사용 —
서버가 `recordSilently("ai_search_request", ...)`로 직접 기록하므로 클라 조작 불가.
Render 무료 티어는 재시작이 잦아 인메모리 카운터가 리셋되므로 DB 카운트가 유일하게
신뢰 가능. 폴백은 저빈도(한도 자체가 상한)라 카운트 쿼리 부하는 무시 가능.

**Alternatives considered**:
- 인메모리 버킷(bucket4j 등) — 콜드스타트·재배포마다 리셋되어 한도가 사실상 무력화. 기각.
- 전용 quota 테이블 — 테이블·마이그레이션 추가 대비 이득 없음. 기각.
- 게스트 세션 갈아타기 남용 — 알려진 한계로 수용(적대적 사용자 아닌 비용 사고 방지가 목적, 최악 비용도 미미).

## R7. 타임아웃·오류 처리

**Decision**: LLM 호출은 서비스 레벨 10초 컷(가상 스레드 + orTimeout — 기존 meta 3s
컷과 동일 패턴). 메타 해석은 기존 4s 컷 그대로(후보별 병렬이라 추가 지연 최대 4s).
LLM 실패·타임아웃은 502 `{code:"AI_UPSTREAM_ERROR"}` 표준 바디 → 프론트는 기존 F4
(오류) 패턴 + 재시도. 프론트 요청 타임아웃·취소는 기존 15s + AbortController 재사용.
취소된 요청은 결과·기록에 반영하지 않는다(단, 서버 quota 카운트는 요청 접수 시점
기준 — 취소해도 소모, 남용 방지).

**Rationale**: 총 예산 10s(LLM) + 4s(meta) < 15s(프론트 컷) = SC-003(p95 15s) 충족
구조. 기존 오류 UX(F4)·취소 시트 패턴을 그대로 써서 프론트 신규 상태 최소화.

**Alternatives considered**: LLM 재시도 내장 — 15s 예산 내 재시도 여유 없음. 사용자
주도 재시도(US3)로 대체.

## R8. 입력 검증

**Decision**: query 2~200자(트림 후). 범위 밖은 클라에서 사전 안내 + 서버 400
`{code:"INVALID_QUERY"}` 이중 방어. 내용 필터링(욕설 등)은 하지 않음 — 곡과 무관한
입력은 LLM이 무후보로 반환하고 무후보 UX(단서 안내)로 흡수(spec Edge Case 정합).

**Rationale**: 200자면 가사 조각+상황 설명에 충분하고 토큰 비용 상한도 겸한다.

## R9. Mock 전략

**Decision**: `AiSongFinderClient` 인터페이스 + `@Profile("!ai-mock")` 실구현 /
`@Profile("ai-mock")` 목업 — acr-mock과 동일 패턴. 시나리오는
`melolist.ai.mock.scenario=${AI_MOCK_SCENARIO:hit}` = `hit`(후보 3곡) | `empty`(무후보)
| `error`(업스트림 오류) | `slow`(12s 지연 → 타임아웃 검증). 로컬 E2E는
`SPRING_PROFILES_ACTIVE=acr-mock,ai-mock` 병행 활성화(메타 해석도 목업). 프론트는
`searchMock.ts`에 동일 시나리오 추가.

**Rationale**: constitution 원칙 VI. 기존 패턴 복제라 학습 비용 0.

## R10. 응답 스키마 — 기존 `AcrResult` 호환

**Decision**: 후보 DTO는 기존 검색 응답의 결과 항목과 동일 형태로 내린다:
`{acrid: "ai-…", title, artists: string[], album, release_date: null, score: null,
youtube_video_id, youtube_url, cover_url}`. `score`/`release_date`는 null 허용으로
프론트 타입만 완화.

**Rationale**: `ResultsView`·`CoverArt` 등 기존 카드 컴포넌트를 그대로 재사용(spec
FR-004 "기존 검색 결과와 동일한 정보 구성"). **artists는 배열** — 과거 문자열로
내렸다가 프론트가 깨진 버그(07-16 수정)의 재발 방지 규칙을 계약에 명시한다.

**Alternatives considered**: 전용 후보 스키마 신설 — 프론트 카드·저장 흐름 분기가
늘어남. 기각.
