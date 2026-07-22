package com.melolist.admin.error;

/** 자기 자신의 ADMIN 해제 시도 — 409 SELF_DEMOTION_FORBIDDEN (front 계약 §5, 관리자 0명 사태 방지). */
public class SelfDemotionForbiddenException extends RuntimeException {

    public SelfDemotionForbiddenException() {
        super("자기 자신의 관리자 권한은 해제할 수 없습니다.");
    }
}
