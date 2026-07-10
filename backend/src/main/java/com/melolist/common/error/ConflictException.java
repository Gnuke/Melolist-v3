package com.melolist.common.error;

/** 상태 충돌 → 409. 대표 사례: 1인 1리뷰 중복 작성(PRD §7 community). */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
