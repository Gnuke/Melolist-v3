package com.melolist.search.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * AI 자연어 폴백 검색 설정(spec 002). OpenAI 키·모델은 Spring AI 표준 경로
 * ({@code spring.ai.openai.*})로 바인딩하고, 여기는 파이프라인 정책 값만 둔다.
 */
@ConfigurationProperties(prefix = "melolist.ai")
public record AiProperties(
        /* LLM 호출 컷(R7) — meta 4s와 합쳐 프론트 15s 예산 안(SC-003) */
        @DefaultValue("10000") int timeoutMs,
        /* reasoning 강도(gpt-5.4 계열: none~xhigh). "none"이면 옵션 자체를 보내지 않는다(비reasoning 모델용) */
        @DefaultValue("low") String reasoningEffort,
        /* 후보별 메타 대조 체인(최대 3회 조회) 소프트 데드라인 — 12s 꼬리를 잘라 클라 15s 예산 보호.
           넘긴 후보는 미검증 처리(제외). 실측 정상 체인 6.8~8.3s라 8s로 설정 */
        @DefaultValue("8000") int metaDeadlineMs,
        @DefaultValue Quota quota
) {
    /** 일일 한도(Asia/Seoul 자정 리셋) — 게스트=세션, 로그인=계정 기준(R6). */
    public record Quota(
            @DefaultValue("3") int guestDaily,
            @DefaultValue("10") int userDaily
    ) {
    }
}
