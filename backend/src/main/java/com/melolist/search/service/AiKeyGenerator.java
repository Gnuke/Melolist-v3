package com.melolist.search.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

/**
 * AI 폴백 후보 곡의 결정적 식별 키(spec 002, R5·data-model §1).
 * {@code ai-<sha256(normalize(title)|normalize(artist)) 앞 16 hex>} (총 19자, acrid 컬럼 64자 수용).
 * acrid 컬럼에 저장해 기존 findByAcrid dedup·즐겨찾기 계약을 무변경으로 재사용한다.
 * select 시 서버가 재계산해 클라이언트 값과 대조한다(위조 방지).
 */
public final class AiKeyGenerator {

    private static final String PREFIX = "ai-";
    private static final int KEY_HEX_LENGTH = 16;

    private AiKeyGenerator() {
    }

    public static String keyOf(String title, String artist) {
        String material = normalize(title) + "|" + normalize(artist);
        byte[] digest = sha256(material.getBytes(StandardCharsets.UTF_8));
        return PREFIX + HexFormat.of().formatHex(digest).substring(0, KEY_HEX_LENGTH);
    }

    public static boolean isAiKey(String acrid) {
        return acrid != null && acrid.startsWith(PREFIX);
    }

    /** 정규화: 트림 → 소문자 → 연속 공백 1개로 축약. 표기 차이로 키가 갈라지는 것을 줄인다. */
    static String normalize(String s) {
        if (s == null) {
            return "";
        }
        return s.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static byte[] sha256(byte[] input) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(input);
        } catch (NoSuchAlgorithmException e) {
            // JVM 필수 알고리즘 — 발생 불가
            throw new IllegalStateException(e);
        }
    }
}
