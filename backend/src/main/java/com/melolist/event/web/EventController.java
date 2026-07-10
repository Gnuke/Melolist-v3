package com.melolist.event.web;

import com.melolist.auth.CurrentUser;
import com.melolist.event.dto.EventRequest;
import com.melolist.event.service.EventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 이벤트 수집 — 인증 불요, fire-and-forget(프론트는 실패 무시 가능), 응답 204.
 * (backend-prd §6.1)
 */
@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void collect(
            @RequestHeader("X-Session-Id") UUID sessionId,
            @Valid @RequestBody EventRequest request,
            @AuthenticationPrincipal Jwt jwt
    ) {
        eventService.record(request.type(), sessionId, CurrentUser.idOrNull(jwt), request.properties());
    }
}
