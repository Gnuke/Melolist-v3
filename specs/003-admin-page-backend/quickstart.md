# Quickstart: 관리자 어드민 백엔드 — 검증 가이드

**목적**: 구현 완료 후 기능이 E2E로 동작함을 증명하는 실행 시나리오.
계약 상세는 [contracts/admin-api.md](./contracts/admin-api.md), 스키마는 [data-model.md](./data-model.md) 참조.

## 사전 조건

- `backend/.env` — 기존 Supabase 연결 설정 그대로(어드민은 외부 API 없음 → ACRCloud 키·acr-mock 불필요)
- Supabase 마이그레이션 `add_admin_audit_and_music_lock` 적용 완료(data-model §5)
- 관리자 지정: Supabase SQL Editor에서
  `update profiles set role = 'ADMIN' where email = '<운영자 이메일>';`
- JWT 2개 준비: **관리자 토큰**(위 계정으로 프론트 로그인 → 개발자도구에서 access token)·
  **일반 사용자 토큰**(다른 계정)

## 1. 빌드·테스트 게이트 (원칙 VI)

```powershell
cd backend
./gradlew build   # 신규 단위 테스트 포함 전체 통과 + 기존 테스트 회귀 0건(SC-005)
```

## 2. 로컬 기동 + 인가 검증 (FR-001, SC-003)

```powershell
./gradlew bootRun
```

| 검증 | 요청 | 기대 |
|---|---|---|
| 게스트 차단 | `curl -i localhost:8080/api/admin/metrics` | **401** |
| 일반 사용자 차단 | 〃 + `-H "Authorization: Bearer <일반토큰>"` | **403** `{"code":"FORBIDDEN"}` |
| 관리자 허용 | 〃 + `-H "Authorization: Bearer <관리자토큰>"` | **200** |
| 기존 기능 무영향 | `curl -i localhost:8080/api/music/1` (무토큰) | 기존과 동일 동작(FR-012) |

이하 curl은 전부 `-H "Authorization: Bearer <관리자토큰>"` 가정.

## 3. 지표 대시보드 (US1, SC-001·SC-006)

```powershell
curl "localhost:8080/api/admin/metrics?days=14"
```

- [ ] `kr2.rows`(모드별+전체 롤업, 행별 pass)·`kr2_breakdown`·`kr3`·`failures`·`weekly`·`totals`가
  front 계약 §1 형태로 반환
- [ ] **SC-006 대조**: 같은 기간(interval '14 days')으로 `backend/db/queries/kr_metrics.sql`을
  Supabase SQL Editor에서 실행 → p95·구간 분해·완료율·실패 분포·주간 추이 값이 API 응답과 일치
- [ ] `days=0`·`days=91` → 400 `{"code":"INVALID_ARGUMENT"}`
- [ ] `days=90`(최대 기간)에도 지표 응답 < 3s, 직후 일반 검색 API 응답 정상(FR-014)
- [ ] 지표 응답 어디에도 세션 식별자 등 게스트 개인 식별 정보 없음 — 집계 값만(FR-013)

## 4. 곡 정정·잠금·삭제 차단 (US2)

```powershell
# 목록·검색·누락 필터(front 계약 §2)
curl "localhost:8080/api/admin/music?query=blank"
curl "localhost:8080/api/admin/music?missing=video"
# 상세(참조 카운트 확인 — 백엔드 전용)
curl "localhost:8080/api/admin/music/{id}"
# 부분 정정(담긴 필드만) → meta_locked=true 확인
curl -X PATCH "localhost:8080/api/admin/music/{id}" -H "Content-Type: application/json" `
  -d '{"youtube_video_id":"dQw4w9WgXcQ"}'
```

- [ ] PATCH 응답 `meta_locked: true`, 담기지 않은 필드는 미변경, 이후 사용자
  화면(`GET /api/music/{id}`)에 수정 값 반영(US2-2)
- [ ] 빈 문자열 전송(`{"cover_url":""}`) → 해당 필드가 null로 비워짐(front 계약 §3)
- [ ] **잠금 보호(US2-3)**: 단위 테스트 `MusicService fillMissing — 잠긴 곡 미변경` GREEN
  (실검색 재인식으로도 확인 가능하나 ACRCloud 실호출 필요 — 테스트로 충분)
- [ ] 참조 있는 곡 DELETE → **409** + 참조 현황 메시지(US2-4) / 참조 없는 곡 → 204
- [ ] `youtube_video_id`에 11자가 아닌 값 → 400 `{"code":"INVALID_ARGUMENT","details":{"field":"youtube_video_id"}}`

## 5. 사용자·모더레이션 (US3)

```powershell
curl "localhost:8080/api/admin/users?query=<닉네임일부>"
curl "localhost:8080/api/admin/users/{uuid}"          # activity 요약 확인(백엔드 전용)
# 역할 변경(front 계약 §5)
curl -X PATCH "localhost:8080/api/admin/users/{uuid}/role" -H "Content-Type: application/json" -d '{"role":"ADMIN"}'
curl "localhost:8080/api/admin/reviews"
curl -X DELETE "localhost:8080/api/admin/reviews/{id}"
curl -X DELETE "localhost:8080/api/admin/comments/{id}"
curl -X POST   "localhost:8080/api/admin/playlists/{id}/unpublish"
```

- [ ] 역할 변경 200 + 응답 `role` 갱신, **자기 자신의 ADMIN 해제** → 409
  `{"code":"SELF_DEMOTION_FORBIDDEN"}`, `{"role":"SUPERUSER"}` → 400 INVALID_ARGUMENT
- [ ] 리뷰 삭제 후 해당 작성자로 `POST /api/reviews` → 409가 아닌 정상 작성(US3-2)
- [ ] unpublish 후 `GET /api/community/playlists`에서 사라짐 + 소유자 `GET /api/playlists`에는 유지(US3-3)
- [ ] 댓글 삭제 시 대댓글 동반 삭제

## 6. 감사 기록 (FR-011, SC-004)

위 §4~5의 변경 작업 수만큼 행이 남았는지 Supabase SQL Editor에서:

```sql
select action, target_type, target_id, admin_id, detail, created_at
from admin_audit_log order by id;
```

- [ ] MUSIC_UPDATE(before/after 포함)·MUSIC_DELETE·REVIEW_DELETE·COMMENT_DELETE·PLAYLIST_UNPUBLISH·ROLE_CHANGE 각 1행 이상, 누락 0건

## 7. 완료 판정 (Definition of Done)

1. §1 빌드·테스트 게이트 통과(기존 테스트 회귀 0건 — SC-005)
2. §2 인가 매트릭스 4행 전부 기대값(SC-003)
3. §3 SC-006 대조 일치
4. §4~5 체크리스트 전부 통과
5. §6 감사 기록 누락 0건(SC-004)
6. 실행 PRD 갱신은 **spec 002 병합 → rebase 후** 커밋(research D9) — PR 머지 전 최종 항목
