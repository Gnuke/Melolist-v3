package com.melolist.admin.service;

import com.melolist.admin.dto.AdminMetricsDtos.FailureRow;
import com.melolist.admin.dto.AdminMetricsDtos.Kr2;
import com.melolist.admin.dto.AdminMetricsDtos.Kr2BreakdownRow;
import com.melolist.admin.dto.AdminMetricsDtos.Kr2Row;
import com.melolist.admin.dto.AdminMetricsDtos.Kr3;
import com.melolist.admin.dto.AdminMetricsDtos.MetricsResponse;
import com.melolist.admin.dto.AdminMetricsDtos.Totals;
import com.melolist.admin.dto.AdminMetricsDtos.WeeklyRow;
import com.melolist.admin.repository.AdminStatsRepository;
import com.melolist.admin.repository.AdminStatsRepository.ModeStatsRow;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * 운영 지표 조립(US1) — front 계약 §1. 산출 정의는 kr_metrics.sql과 동일(SC-006):
 * KR2 p95 ≤ 6,000ms(행별 pass) · KR3 완료 세션 ÷ 방문 세션 ≥ 70%(분모 0이면 pct null·pass false).
 * 기간은 kr_metrics.sql과 동일한 롤링 윈도(now − days).
 */
@Service
@RequiredArgsConstructor
public class AdminMetricsService {

    private static final int DEFAULT_DAYS = 14;
    private static final int MIN_DAYS = 1;
    private static final int MAX_DAYS = 90;
    private static final long KR2_TARGET_MS = 6_000L;
    private static final int KR3_TARGET_PCT = 70;

    private final AdminStatsRepository adminStatsRepository;

    @Transactional(readOnly = true)
    public MetricsResponse metrics(int days) {
        if (days < MIN_DAYS || days > MAX_DAYS) {
            throw new IllegalArgumentException("days는 %d~%d 사이여야 합니다.".formatted(MIN_DAYS, MAX_DAYS));
        }
        Instant toTs = Instant.now();
        Instant fromTs = toTs.minus(days, ChronoUnit.DAYS);

        List<ModeStatsRow> modeRows = adminStatsRepository.modeStats(fromTs, toTs);
        return new MetricsResponse(
                days,
                kr2(modeRows),
                kr2Breakdown(fromTs, toTs),
                kr3(fromTs, toTs),
                failures(fromTs, toTs),
                weekly(),
                totals(modeRows)
        );
    }

    private Kr2 kr2(List<ModeStatsRow> modeRows) {
        List<Kr2Row> rows = modeRows.stream()
                .map(row -> {
                    Long p95 = toMs(row.getP95Ms());
                    return new Kr2Row(row.getMode(), zero(row.getN()), zero(row.getMatchedN()),
                            toMs(row.getP50Ms()), p95, toMs(row.getMaxMs()),
                            p95 != null && p95 <= KR2_TARGET_MS);
                })
                .toList();
        return new Kr2(KR2_TARGET_MS, rows);
    }

    private List<Kr2BreakdownRow> kr2Breakdown(Instant fromTs, Instant toTs) {
        return adminStatsRepository.kr2Breakdown(fromTs, toTs).stream()
                .map(row -> new Kr2BreakdownRow(row.getMode(), zero(row.getN()),
                        toMs(row.getAcrP95Ms()), toMs(row.getMetaP95Ms()),
                        toMs(row.getUpsertP95Ms()), toMs(row.getTotalP95Ms())))
                .toList();
    }

    private Kr3 kr3(Instant fromTs, Instant toTs) {
        AdminStatsRepository.CompletionRow row = adminStatsRepository.completion(fromTs, toTs);
        long visits = zero(row.getVisitSessions());
        long completed = zero(row.getCompletedSessions());
        Double pct = visits == 0 ? null : Math.round(1000.0 * completed / visits) / 10.0;
        boolean pass = pct != null && pct >= KR3_TARGET_PCT;
        return new Kr3(KR3_TARGET_PCT, visits, completed, pct, pass);
    }

    private List<FailureRow> failures(Instant fromTs, Instant toTs) {
        return adminStatsRepository.failures(fromTs, toTs).stream()
                .map(row -> new FailureRow(row.getMode(), row.getReason(), zero(row.getN())))
                .toList();
    }

    private List<WeeklyRow> weekly() {
        return adminStatsRepository.weekly().stream()
                .map(row -> new WeeklyRow(row.getWeek(), row.getMode(), zero(row.getN()), toMs(row.getP95Ms())))
                .toList();
    }

    /** search/matched는 기간 내(KR2 롤업의 전체 행에서 파생), user/music은 누적. */
    private Totals totals(List<ModeStatsRow> modeRows) {
        ModeStatsRow overall = modeRows.stream()
                .filter(row -> row.getMode() == null)
                .findFirst()
                .orElse(null);
        AdminStatsRepository.CumulativeCountsRow counts = adminStatsRepository.cumulativeCounts();
        return new Totals(
                overall == null ? 0L : zero(overall.getN()),
                overall == null ? 0L : zero(overall.getMatchedN()),
                zero(counts.getUserCount()),
                zero(counts.getMusicCount())
        );
    }

    private long zero(Long value) {
        return value == null ? 0L : value;
    }

    private Long toMs(Double value) {
        return value == null ? null : Math.round(value);
    }
}
