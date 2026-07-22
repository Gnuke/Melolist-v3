package com.melolist.admin.error;

import lombok.Getter;

/** 어드민 입력 검증 실패 — 400 INVALID_ARGUMENT + details.field (front 계약 §3). */
@Getter
public class InvalidAdminArgumentException extends RuntimeException {

    private final String field;

    public InvalidAdminArgumentException(String field, String message) {
        super(message);
        this.field = field;
    }
}
