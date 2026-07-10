package com.melolist.common.error;

/** 리소스 없음 → 404. 비공개 리소스도 존재 노출을 피하기 위해 404로 응답한다. */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }
}
