package com.melolist.event.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

/**
 * 이벤트 수집 요청(backend-prd §6.1). session_id는 {@code X-Session-Id} 헤더로 받는다.
 * properties는 이벤트 사전(M2 4종)의 자유 형식 속성.
 */
public record EventRequest(
        @NotBlank String type,
        Map<String, Object> properties
) {
}
