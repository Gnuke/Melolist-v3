package com.melolist.search.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 웹검색 심층 탐색 설정(spec 004). {@link AiProperties}에 넣지 않고 분리한 이유:
 * record 컴포넌트 추가는 canonical 생성자를 바꿔 기존 002 테스트 전부에 파급된다.
 */
@ConfigurationProperties(prefix = "melolist.ai.deep")
public record DeepSearchProperties(
        /* 웹검색 LLM 호출 컷 — 발동 실측 최대 21.5s + 여유(R3). 메타 8s와 합쳐 서버 최악 ~30s */
        @DefaultValue("22000") int timeoutMs,
        /* 로그인 사용자당 일일 실행 한도(Asia/Seoul 자정 리셋) — 회당 비용 캡(R6) */
        @DefaultValue("2") int userDaily
) {
}
