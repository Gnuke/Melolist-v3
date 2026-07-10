package com.melolist.common.error;

/** 인증은 됐지만 권한 없음(작성자/소유자 아님) → 403. */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
