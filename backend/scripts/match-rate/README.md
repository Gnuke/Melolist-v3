# KR1 매칭률 측정 (backend-prd §10, C6)

테스트 곡 셋을 `/api/search/*`에 투입해 **Top-3 내 정답 포함 여부**를 판정하고
모드별 매칭률과 KR1(지문 ≥80% · 허밍 ≥50%) 판정을 출력한다. CI 무관 수동 실행 —
분기 중 3회 이상(M2 중간·완료·분기 말) 돌려 devlog/체크인에 결과를 남긴다.

## 준비

1. `manifest.example.json` → `manifest.json` 복사 후 실제 곡 셋 기입 (지문 30 + 허밍 20 권장)
2. `audio/` 디렉터리에 오디오 파일 배치
   - 지문: 원음 재생을 마이크로 녹음한 클립(10초 내외) — 실사용 조건 재현
   - 허밍: 직접 부른 녹음(8초 이상)
   - **오디오는 커밋 금지**(.gitignore 처리, constitution 원칙 IV)
3. 정답 판정 기준: `acrid`(알고 있으면 — 판정이 정확해짐) 또는 `title`+`artist`
   (괄호·대소문자·공백을 무시하는 느슨 일치)

## 실행

```bash
# 로컬 백엔드 (기본)
node match-rate.mjs

# 운영 (Render는 먼저 /actuator/health로 웜업할 것)
node match-rate.mjs --base https://melolist-v3.onrender.com

# 허밍만, 호출 간격 3초
node match-rate.mjs --only humming --delay 3000
```

- 곡당 1회 순차 호출(기본 간격 2초) — ACRCloud 과금·레이트 보호
- 결과: 콘솔에 곡별 HIT/MISS + 요약 표(devlog에 붙여넣기), `reports/`에 JSON 리포트(커밋 금지)
- 스모크: acr-mock 백엔드(`SPRING_PROFILES_ACTIVE=acr-mock`)에 더미 오디오로 실행하면
  파이프라인만 검증 가능(mock은 오디오와 무관하게 고정 결과 반환)

## 주의

- 운영에 돌리면 `search_request` 이벤트가 기록돼 KR2/KR3 지표에 섞인다 —
  측정 후 event_log에서 해당 시간대 게스트 레코드를 정리하거나, 측정은 로컬
  백엔드(실 ACR 키) 경유를 권장한다(이벤트가 로컬 세션으로 남아 구분 쉬움).
- 같은 곡 재검색은 MUSIC upsert 캐시에 히트하므로 DB에 중복 행을 만들지 않는다.
