package com.melolist.admin.error;

import com.melolist.common.error.ErrorResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * 어드민 전용 에러 코드 매핑(front 계약 §0·§3·§5) — INVALID_ARGUMENT·SELF_DEMOTION_FORBIDDEN.
 * basePackages 한정으로 admin 컨트롤러에만 적용되며, 여기서 선언하지 않은 예외
 * (ForbiddenException 403 등)는 기존 GlobalExceptionHandler로 넘어간다(공용 파일 무수정 — FR-012).
 */
@RestControllerAdvice(basePackages = "com.melolist.admin")
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AdminApiExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgument(IllegalArgumentException e) {
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of("INVALID_ARGUMENT", e.getMessage()));
    }

    @ExceptionHandler(InvalidAdminArgumentException.class)
    public ResponseEntity<ErrorResponse> handleInvalidArgument(InvalidAdminArgumentException e) {
        return ResponseEntity.badRequest()
                .body(ErrorResponse.of("INVALID_ARGUMENT", e.getMessage(), Map.of("field", e.getField())));
    }

    @ExceptionHandler(SelfDemotionForbiddenException.class)
    public ResponseEntity<ErrorResponse> handleSelfDemotion(SelfDemotionForbiddenException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(ErrorResponse.of("SELF_DEMOTION_FORBIDDEN", e.getMessage()));
    }
}
