package com.melolist.admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import java.time.LocalDate;
import java.util.List;

/**
 * 운영 지표 응답 — front 계약 §1(정본: adminpage-front contracts/admin-api.md).
 * 산출 정의는 backend/db/queries/kr_metrics.sql을 따른다(no_match 포함, mode=null 행 = 전체 롤업).
 */
public final class AdminMetricsDtos {

    private AdminMetricsDtos() {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record MetricsResponse(
            int periodDays,
            Kr2 kr2,
            List<Kr2BreakdownRow> kr2Breakdown,
            Kr3 kr3,
            List<FailureRow> failures,
            List<WeeklyRow> weekly,
            Totals totals
    ) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Kr2(long targetMs, List<Kr2Row> rows) {
    }

    /** mode=null 행 = 전체 롤업. pass = p95 ≤ target. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Kr2Row(String mode, long n, long matchedN, Long p50Ms, Long p95Ms, Long maxMs, boolean pass) {
    }

    /** upsert_p95_ms는 비동기 측정치(응답 경로 밖) — 화면 주석 전제(front 계약 §1). */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Kr2BreakdownRow(String mode, long n, Long acrP95Ms, Long metaP95Ms, Long upsertP95Ms, Long totalP95Ms) {
    }

    /** completion_pct는 분모(visit) 0이면 null, 그때 pass는 false. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Kr3(int targetPct, long visitSessions, long completedSessions, Double completionPct, boolean pass) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record FailureRow(String mode, String reason, long n) {
    }

    /** 최신 주 먼저, mode별 행만(전체 롤업 없음), 기간과 무관하게 전체 주간. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record WeeklyRow(LocalDate week, String mode, long n, Long p95Ms) {
    }

    /** search/matched는 기간 내, user/music은 누적. */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record Totals(long searchCount, long matchedCount, long userCount, long musicCount) {
    }
}
