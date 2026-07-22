package com.melolist.search.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * AI 자연어 폴백 검색 요청(spec 002 contracts §1). 길이 상한은 토큰 비용 상한을 겸한다(R8).
 */
public record TextSearchRequest(
        @NotBlank(message = "곡 설명을 입력해 주세요.")
        @Size(min = 2, max = 200, message = "검색 설명은 2~200자여야 합니다.")
        String query
) {
}
