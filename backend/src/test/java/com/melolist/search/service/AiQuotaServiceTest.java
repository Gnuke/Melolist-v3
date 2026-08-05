package com.melolist.search.service;

import com.melolist.common.error.AiQuotaExceededException;
import com.melolist.event.repository.EventLogRepository;
import com.melolist.search.config.AiProperties;
import com.melolist.search.config.DeepSearchProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** AI 폴백 일일 한도(spec 002, R6) — 게스트=세션 3회, 로그인=계정 10회, Asia/Seoul 자정 리셋. */
@ExtendWith(MockitoExtension.class)
class AiQuotaServiceTest {

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID SESSION_ID = UUID.randomUUID();
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    @Mock
    private EventLogRepository eventLogRepository;

    private AiQuotaService aiQuotaService;

    @BeforeEach
    void setUp() {
        aiQuotaService = new AiQuotaService(eventLogRepository,
                new AiProperties(10_000, "low", 8_000, new AiProperties.Quota(3, 10)),
                new DeepSearchProperties(22_000, 2));
    }

    @Test
    void 로그인_사용자는_계정_기준_오늘_자정_이후만_센다() {
        ArgumentCaptor<Instant> since = ArgumentCaptor.forClass(Instant.class);
        when(eventLogRepository.countByTypeAndUserSince(
                eq(AiQuotaService.COUNTED_EVENT_TYPE), eq(USER_ID), since.capture())).thenReturn(9L);

        assertThatCode(() -> aiQuotaService.checkQuota(SESSION_ID, USER_ID)).doesNotThrowAnyException();

        assertThat(since.getValue())
                .isEqualTo(ZonedDateTime.now(SEOUL).truncatedTo(ChronoUnit.DAYS).toInstant());
        verify(eventLogRepository, never()).countByTypeAndSessionSince(any(), any(), any());
    }

    @Test
    void 계정_한도를_채우면_429에_한도와_리셋_시각을_담는다() {
        when(eventLogRepository.countByTypeAndUserSince(
                eq(AiQuotaService.COUNTED_EVENT_TYPE), eq(USER_ID), any())).thenReturn(10L);

        assertThatThrownBy(() -> aiQuotaService.checkQuota(SESSION_ID, USER_ID))
                .isInstanceOfSatisfying(AiQuotaExceededException.class, ex -> {
                    assertThat(ex.getLimit()).isEqualTo(10);
                    assertThat(ex.getResetAt().getZone()).isEqualTo(SEOUL);
                    assertThat(ex.getResetAt().toLocalTime()).isEqualTo(LocalTime.MIDNIGHT);
                    assertThat(ex.getResetAt()).isAfter(ZonedDateTime.now(SEOUL));
                });
    }

    @Test
    void 게스트는_세션_기준_3회_한도다() {
        when(eventLogRepository.countByTypeAndSessionSince(
                eq(AiQuotaService.COUNTED_EVENT_TYPE), eq(SESSION_ID), any())).thenReturn(3L);

        assertThatThrownBy(() -> aiQuotaService.checkQuota(SESSION_ID, null))
                .isInstanceOfSatisfying(AiQuotaExceededException.class,
                        ex -> assertThat(ex.getLimit()).isEqualTo(3));
        verify(eventLogRepository, never()).countByTypeAndUserSince(any(), any(), any());
    }

    @Test
    void 게스트도_한도_미만이면_통과한다() {
        when(eventLogRepository.countByTypeAndSessionSince(
                eq(AiQuotaService.COUNTED_EVENT_TYPE), eq(SESSION_ID), any())).thenReturn(2L);

        assertThatCode(() -> aiQuotaService.checkQuota(SESSION_ID, null)).doesNotThrowAnyException();
    }

    // ── 심층 탐색 한도(spec 004, R6) — 로그인 사용자 전용, deep_search_request 원장.
    //    카운트는 차감분 전용 쿼리(countBillable…: outcome=quota·error 제외 — 서버 오류 환불,
    //    2026-08-05 개정)를 쓴다. 002의 quota만 제외하는 쿼리를 쓰면 안 된다. ──

    @Test
    void 심층_한도는_사용자_기준_오늘_자정_이후_차감분만_센다() {
        ArgumentCaptor<Instant> since = ArgumentCaptor.forClass(Instant.class);
        when(eventLogRepository.countBillableByTypeAndUserSince(
                eq(AiQuotaService.DEEP_COUNTED_EVENT_TYPE), eq(USER_ID), since.capture())).thenReturn(1L);

        assertThatCode(() -> aiQuotaService.checkDeepQuota(USER_ID)).doesNotThrowAnyException();

        assertThat(since.getValue())
                .isEqualTo(ZonedDateTime.now(SEOUL).truncatedTo(ChronoUnit.DAYS).toInstant());
        verify(eventLogRepository, never()).countByTypeAndUserSince(any(), any(), any());
        verify(eventLogRepository, never()).countByTypeAndSessionSince(any(), any(), any());
    }

    @Test
    void 심층_한도를_채우면_429에_심층_문구와_리셋_시각을_담는다() {
        when(eventLogRepository.countBillableByTypeAndUserSince(
                eq(AiQuotaService.DEEP_COUNTED_EVENT_TYPE), eq(USER_ID), any())).thenReturn(2L);

        assertThatThrownBy(() -> aiQuotaService.checkDeepQuota(USER_ID))
                .isInstanceOfSatisfying(AiQuotaExceededException.class, ex -> {
                    assertThat(ex.getLimit()).isEqualTo(2);
                    assertThat(ex.getMessage()).contains("심층 탐색");
                    assertThat(ex.getResetAt().getZone()).isEqualTo(SEOUL);
                    assertThat(ex.getResetAt().toLocalTime()).isEqualTo(LocalTime.MIDNIGHT);
                    assertThat(ex.getResetAt()).isAfter(ZonedDateTime.now(SEOUL));
                });
    }

    @Test
    void 심층_잔여_조회는_limit_used_remaining_resetAt을_계산한다() {
        when(eventLogRepository.countBillableByTypeAndUserSince(
                eq(AiQuotaService.DEEP_COUNTED_EVENT_TYPE), eq(USER_ID), any())).thenReturn(1L);

        AiQuotaService.DeepUsage usage = aiQuotaService.deepUsage(USER_ID);

        assertThat(usage.limit()).isEqualTo(2);
        assertThat(usage.used()).isEqualTo(1);
        assertThat(usage.remaining()).isEqualTo(1);
        assertThat(usage.resetAt())
                .isEqualTo(ZonedDateTime.now(SEOUL).truncatedTo(ChronoUnit.DAYS).plusDays(1));
    }

    @Test
    void 심층_잔여는_초과_사용이어도_0_밑으로_내려가지_않는다() {
        when(eventLogRepository.countBillableByTypeAndUserSince(
                eq(AiQuotaService.DEEP_COUNTED_EVENT_TYPE), eq(USER_ID), any())).thenReturn(5L);

        assertThat(aiQuotaService.deepUsage(USER_ID).remaining()).isZero();
    }
}
