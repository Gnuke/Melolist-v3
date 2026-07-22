# Melolist-v3 · Backend

Melolist-v3의 백엔드. 기존 Nuxt(Nitro) 서버를 **Spring Boot + Supabase**로 재플랫폼한다.
자세한 제품 요구사항은 [`docs/prd/backend-prd.md`](../docs/prd/backend-prd.md)(백엔드 실행 PRD) 참고.

## 기술 스택

| 구분 | 선택 |
|---|---|
| Runtime | **Java 21 (LTS)** — Spring AI(M5) 대비 LTS 기준 |
| Framework | Spring Boot 3.5.16 (Domain 중심 패키지 구조) |
| Build | Gradle 8.14 (wrapper 포함) |
| Security | Spring Security — Supabase JWT(JWKS) Resource Server 검증 |
| ORM | Spring Data JPA / Hibernate |
| DB | Supabase PostgreSQL (테스트는 H2 인메모리) |
| 부가 | Lombok, Bean Validation, Actuator |

> **Java 21 기준.** `build.gradle`의 toolchain이 source/target을 21로 고정한다.
> 로컬에 JDK 21이 없으면 Gradle Foojay 리졸버(`settings.gradle`)가 자동 프로비저닝한다.

## 도메인 구조

```
com.melolist
├─ auth            # Supabase JWT 검증/인가 지원
├─ user            # 프로필(JIT 프로비저닝), /users/me
├─ music           # 곡 메타데이터·인식결과 캐시(MUSIC) — 저장 대상의 출처
├─ search          # 지문/허밍/텍스트 검색, ACRCloud, 검색기록
├─ playlist        # 플레이리스트 CRUD, 트랙 관리
├─ community       # 리뷰(1인1리뷰)·즐겨찾기·댓글·팔로우(P2)
├─ recommendation  # (AI) 추천·자연어 검색 확장 슬롯 (Spring AI)
└─ common          # 공통 설정(Security/CORS)·에러 응답
```

## 실행

```bash
# 환경변수 준비
cp .env.example .env   # 값 채우기 (Supabase DB/JWKS 등)

# 빌드 & 테스트 (시크릿 없이도 통과 — 테스트는 H2 + 더미 JWKS 사용)
./gradlew build

# 로컬 실행 (실제 Supabase 값 필요)
./gradlew bootRun
```

- `GET /api/users/me` — 내 프로필(최초 호출 시 JIT 생성). `Authorization: Bearer <supabase-jwt>` 필요.
- `GET /actuator/health` — 헬스체크(비인증).

## Docker

```bash
docker build -t melolist-backend .   # JDK 21 기반 멀티스테이지
docker run -p 8080:8080 --env-file .env melolist-backend
```

## CI

`.github/workflows/ci.yml` — push/PR(main·dev) 시 JDK 21로 `./gradlew build`.
