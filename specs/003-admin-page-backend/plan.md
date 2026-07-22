# Implementation Plan: 관리자 어드민 — 운영 대시보드·데이터 관리 (백엔드)

**Branch**: `feat/admin-backend` | **Date**: 2026-07-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-admin-page-backend/spec.md`

## Summary

ADMIN 역할 사용자 전용 `/api/admin/**` 영역을 **신규 `admin` 도메인 패키지**로 추가한다.
① 운영 지표 대시보드(기존 `event_log`·`profiles` 원천을 `kr_metrics.sql` 정의 그대로
native query로 이식), ② MUSIC 캐시 정정(수정 시 `meta_locked` 잠금 → 자동 upsert가
덮지 않음, 참조 있는 곡 삭제 차단), ③ 사용자 조회·모더레이션(리뷰·댓글 삭제, 공개
플레이리스트 비공개 전환), ④ 전 변경 작업 감사 기록(`admin_audit_log` 신설).

**충돌 회피가 1급 설계 목표**: 병행 브랜치(spec 002, `feat/m5-ai-fallback-search`)가
수정 중인 파일(SecurityConfig·GlobalExceptionHandler·application.yml·EventLogRepository·
MusicService 등)을 건드리지 않는다. 인가는 SecurityConfig 무수정(기존
`anyRequest().authenticated()` + admin 패키지 자체 인터셉터→기존 `ForbiddenException`),
지표 쿼리는 admin 전용 리포지토리 신설로 해결. 유일한 공유 파일 수정은
`MusicService.fillMissing`의 잠금 가드 1줄이며 병합 순서 전략으로 완화한다(research D2).

## Technical Context

**Language/Version**: Java 21 (LTS)

**Primary Dependencies**: Spring Boot 3.5 · Spring Security(JWKS Resource Server, 기존 설정 재사용) · Spring Data JPA(native query 포함, 동일 스택) · Lombok · Bean Validation

**Storage**: Supabase PostgreSQL — 기존 `event_log`·`profiles`·`music`·`favorite`·`playlist_music`·`search_history`·`review`·`comment`·`playlist` 읽기/조치 + **신규 `admin_audit_log` 테이블, `music.meta_locked` 컬럼**(Supabase 마이그레이션)

**Testing**: JUnit 5 + Mockito(기존 서비스 단위 테스트 패턴), `./gradlew build` 게이트 + quickstart 수동 E2E

**Target Platform**: Render 배포 Spring Boot 서버(기존 backend 모듈 내)

**Project Type**: web-service (모노레포 `backend/` — 프론트 화면은 별도 작업 트리, 본 plan 범위 외)

**Performance Goals**: 지표 조회 응답 < 3s(현 데이터 규모 수만 행 + `event_log(event_type, created_at)` 인덱스 활용) · 어드민 트래픽은 관리자 1인 수준

**Constraints**: 기존 공용 파일 수정 최소화(MusicService 가드 1줄이 유일한 예외 — Complexity Tracking) · 지표 조회가 사용자 검색 응답(KR2)을 저해하지 않을 것(FR-014) · 표준 에러 바디·snake_case 신규 계약 유지

**Scale/Scope**: 관리자 1인 · API 11개(지표 1·곡 4·사용자 2·모더레이션 4) · 신규 테이블 1·컬럼 1 · 신규 Java 파일 약 15개

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 도메인 중심 아키텍처 | ✅ PASS | 신규 `com.melolist.admin` 도메인 패키지(Controller·Service·Repository·Entity·DTO 자체 보유). PRD §14가 예고한 관리자 영역의 자연스러운 확장. DTO 계약만 노출, 표준 에러 바디 재사용, 인가는 앱 계층 단독. 지표 native query는 **Spring Data JPA `@Query(nativeQuery)`** — 동일 데이터 접근 스택 내이며 v2식 이중화(별도 드라이버·raw 커넥션)가 아님 |
| II. 계약 우선·문서 위계 | ⚠️ 예외 1건 | 계약은 `contracts/admin-api.md`로 선확정. 단, 화면을 별도 트리에서 병행하므로 "API+화면 한 브랜치·한 PR" 예외 — Complexity Tracking 기록. 실행 PRD(§6.2·§8) 갱신은 PR 마무리 태스크(병합 순서 주의, research D9) |
| III. 측정 기본 탑재 | ✅ PASS | 본 기능 자체가 측정 소비 도구(KR 지표 노출). 관리자 행위는 `admin_audit_log`로 100% 계측(SC-004). 신규 사용자향 지표 없음 → 이벤트 사전 변경 없음 |
| IV. 프라이버시·저작권 (절대) | ✅ PASS | cover_url은 관리자 입력도 **핫링크 URL 문자열만**(형식 검증, 다운로드·재호스팅 없음). 오디오 무관. 게스트 PII 추가 노출 없음(세션 UUID 그대로, IP 없음). 관리자에게 노출되는 개인정보는 기존 profiles 보유분(이메일·닉네임)만 |
| V. 게스트 우선 접근 | ✅ PASS | 기존 게스트 경로 무변경(FR-012). `/api/admin/**`은 기존 `anyRequest().authenticated()`에 이미 포섭 — 화이트리스트 변경 없음 |
| VI. 외부 의존 없는 테스트 | ✅ PASS | 외부 API 연동 없음 → mock 프로파일 불요. 단위 테스트 + 빌드 게이트 + quickstart 수동 E2E. main 상시 빌드 가능 유지 |

**게이트 판정**: PASS (예외 1건은 Complexity Tracking에 정당화 — ERROR 아님)

## Project Structure

### Documentation (this feature)

```text
specs/003-admin-page-backend/
├── plan.md              # 본 파일
├── research.md          # Phase 0 — 설계 결정 10건(D1~D10)
├── data-model.md        # Phase 1 — admin_audit_log·meta_locked·지표 read model
├── quickstart.md        # Phase 1 — 검증 시나리오(마이그레이션→권한→E2E)
├── contracts/
│   └── admin-api.md     # Phase 1 — /api/admin/** 계약(프론트 트리가 소비할 정본)
└── tasks.md             # Phase 2 (/speckit-tasks — 본 명령 범위 아님)
```

### Source Code (repository root)

```text
backend/
├── src/main/java/com/melolist/
│   ├── admin/                                  # ★ 전부 신규 — 유일한 작업 영역
│   │   ├── auth/AdminAuthInterceptor.java      # profiles.role=ADMIN 검사 → ForbiddenException(403)
│   │   ├── config/AdminWebConfig.java          # /api/admin/** 인터셉터 등록(WebMvcConfigurer 추가 등록)
│   │   ├── domain/AdminAuditLog.java           # 감사 기록 엔티티
│   │   ├── repository/
│   │   │   ├── AdminAuditLogRepository.java
│   │   │   ├── AdminStatsRepository.java       # 지표 native query(event_log·profiles) — kr_metrics.sql 이식
│   │   │   └── AdminMusicRepository.java       # 곡 목록 검색 + 참조 카운트(favorite/playlist_music/search_history)
│   │   ├── dto/
│   │   │   ├── AdminMetricsDtos.java
│   │   │   ├── AdminMusicDtos.java
│   │   │   ├── AdminUserDtos.java
│   │   │   └── AdminModerationDtos.java
│   │   ├── service/
│   │   │   ├── AdminAuditService.java          # 변경 작업과 동일 트랜잭션으로 기록
│   │   │   ├── AdminMetricsService.java
│   │   │   ├── AdminMusicService.java
│   │   │   ├── AdminUserService.java
│   │   │   └── AdminModerationService.java
│   │   └── web/
│   │       ├── AdminMetricsController.java     # GET /api/admin/metrics
│   │       ├── AdminMusicController.java       # GET·PATCH·DELETE /api/admin/music*
│   │       ├── AdminUserController.java        # GET /api/admin/users*
│   │       └── AdminModerationController.java  # 리뷰·댓글 삭제, 플레이리스트 unpublish
│   ├── music/domain/Music.java                 # △ 수정 — metaLocked 필드 추가(spec 002 미수정 파일)
│   └── music/service/MusicService.java         # △ 수정 — fillMissing 잠금 가드 1줄(유일한 002 충돌면, research D2)
├── src/test/java/com/melolist/admin/
│   ├── auth/AdminAuthInterceptorTest.java
│   └── service/
│       ├── AdminMusicServiceTest.java          # 정정·잠금·참조 삭제 차단·감사 기록
│       ├── AdminModerationServiceTest.java
│       └── AdminMetricsServiceTest.java
└── (DB) Supabase 마이그레이션: add_admin_audit_and_music_lock
     — alter table music add meta_locked / create table admin_audit_log

docs/backend-prd.md · docs/frontend-prd.md      # △ PR 마무리 시 §6.2·§8 계약 반영(002 병합 후 rebase — D9)
```

**Structure Decision**: 기존 모노레포 `backend/` 안에 도메인 중심 구조 그대로
`com.melolist.admin` 패키지를 신설한다(원칙 I의 8종 패키지에 1종 추가). 프론트엔드
디렉터리는 본 기능에서 변경하지 않는다 — 별도 트리가 `contracts/admin-api.md`를 소비.

## Complexity Tracking

> Constitution Check 예외 및 FR-012(기존 영역 무변경) 예외의 정당화.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 원칙 II "API+화면 한 브랜치·한 PR" 예외 — 관리자 화면은 별도 작업 트리에서 병행 | 사용자 지시(병행 개발로 리드타임 단축·충돌 최소화). 어드민은 내부 도구라 계약 불일치 리스크가 사용자향 기능보다 낮고, `contracts/admin-api.md`를 선확정해 계약 동기화 원칙의 취지(불일치 조기 발견)는 유지 | 한 브랜치 순차 진행 — spec 002 병합 대기와 겹쳐 백엔드·프론트가 직렬화되고, 본 백엔드 트리와 프론트 트리가 같은 파일을 만질 이유도 없어 병행의 충돌 비용이 사실상 0 |
| `MusicService.fillMissing`에 잠금 가드 1줄 추가 — spec 002가 수정 중인 파일(FR-012 예외) | FR-007(관리자 정정 보호)의 강제 지점은 자동 upsert 공유 경로에만 존재. spec 002가 AI 출처 upsert를 추가하고 있어 앞으로 쓰기 경로가 늘어나므로 명시적 잠금이 더 중요해짐 | ① 엔티티 setter 내 가드 — 도메인 규칙이 엔티티 접근자에 숨어 응집 저해. ② 보호 미구현(fillMissing이 null만 채우는 현행 동작에 의존) — 관리자가 필드를 비운 경우 재오염되고, 002의 신규 쓰기 경로에 무방비. **완화**: 가드를 독립 커밋으로 분리, spec 002 병합 후 rebase(병합 순서 002→003, research D2) |
