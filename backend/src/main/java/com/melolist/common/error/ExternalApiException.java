package com.melolist.common.error;

/**
 * 외부 API(ACRCloud 등) 호출 실패 → 502.
 * raw 에러·스택은 응답에 담지 않는다(backend-prd §8 F4). 원인은 서버 로그로만 남긴다.
 */
public class ExternalApiException extends RuntimeException {

    public ExternalApiException(String message, Throwable cause) {
        super(message, cause);
    }
}
