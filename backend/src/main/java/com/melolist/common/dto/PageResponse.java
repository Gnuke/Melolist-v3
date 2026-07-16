package com.melolist.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

/**
 * 페이지네이션 응답 공통 포맷. Spring {@link Page} 직렬화 형태에 의존하지 않고
 * 계약을 고정한다(PRD §4.3 계약 규약 — 신규 계약은 snake_case, 첫 프론트
 * 소비자(M3 즐겨찾기 목록)가 생기는 시점에 통일).
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record PageResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalItems,
        int totalPages
) {
    public static <E, T> PageResponse<T> of(Page<E> page, Function<E, T> mapper) {
        return new PageResponse<>(
                page.getContent().stream().map(mapper).toList(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages()
        );
    }
}
