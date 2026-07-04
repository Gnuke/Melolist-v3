package com.melolist.common.error;

import java.util.Map;

/**
 * 표준 에러 응답 바디. (PRD §4.3 공통 규약)
 * v2처럼 200에 {@code {success:false}}를 섞지 않고, HTTP 상태코드 + 이 바디로 통일한다.
 *
 * @param code    기계가 읽는 에러 코드 (예: NOT_FOUND, VALIDATION_ERROR, CONFLICT)
 * @param message 사람이 읽는 메시지
 * @param details 필드별 상세(검증 오류 등), 없으면 null
 */
public record ErrorResponse(String code, String message, Map<String, String> details) {

    public static ErrorResponse of(String code, String message) {
        return new ErrorResponse(code, message, null);
    }

    public static ErrorResponse of(String code, String message, Map<String, String> details) {
        return new ErrorResponse(code, message, details);
    }
}
