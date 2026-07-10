package com.melolist.search.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * ACRCloud 연동 설정. 키·서명은 서버 전용 환경변수로만 주입한다(backend-prd §9-5).
 * 지문/허밍은 별도 프로젝트(키 2벌) + Metadata API 토큰 2개 체계.
 */
@ConfigurationProperties(prefix = "melolist.acrcloud")
public record AcrCloudProperties(
        /* identify 호스트 — 지문/허밍 프로젝트 리전 동일(ap-southeast-1) 확인됨 */
        @DefaultValue("identify-ap-southeast-1.acrcloud.com") String identifyHost,
        @DefaultValue("eu-api-v2.acrcloud.com") String metadataHost,
        @DefaultValue("10000") int identifyTimeoutMs,
        @DefaultValue("5000") int metadataTimeoutMs,
        @DefaultValue Credentials fingerprint,
        @DefaultValue Credentials humming
) {
    public record Credentials(
            @DefaultValue("") String accessKey,
            @DefaultValue("") String accessSecret,
            @DefaultValue("") String metadataToken
    ) {
    }
}
