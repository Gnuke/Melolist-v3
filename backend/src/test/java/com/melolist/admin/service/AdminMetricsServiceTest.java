package com.melolist.admin.service;

import com.melolist.admin.dto.AdminMetricsDtos.MetricsResponse;
import com.melolist.admin.repository.AdminStatsRepository;
import com.melolist.admin.repository.AdminStatsRepository.CompletionRow;
import com.melolist.admin.repository.AdminStatsRepository.CumulativeCountsRow;
import com.melolist.admin.repository.AdminStatsRepository.ModeStatsRow;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** US1 지표 조립(front 계약 §1) — days 검증·빈 데이터·KR 판정·totals(native query 자체는 실 DB 대조). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminMetricsServiceTest {

    @Mock
    private AdminStatsRepository adminStatsRepository;

    @InjectMocks
    private AdminMetricsService service;

    private void stubEmpty() {
        CompletionRow emptyCompletion = completionRow(null, null);
        CumulativeCountsRow counts = countsRow(0L, 0L);
        when(adminStatsRepository.modeStats(any(), any())).thenReturn(List.of());
        when(adminStatsRepository.kr2Breakdown(any(), any())).thenReturn(List.of());
        when(adminStatsRepository.completion(any(), any())).thenReturn(emptyCompletion);
        when(adminStatsRepository.failures(any(), any())).thenReturn(List.of());
        when(adminStatsRepository.weekly()).thenReturn(List.of());
        when(adminStatsRepository.cumulativeCounts()).thenReturn(counts);
    }

    private CompletionRow completionRow(Long visits, Long completed) {
        CompletionRow row = mock(CompletionRow.class);
        when(row.getVisitSessions()).thenReturn(visits);
        when(row.getCompletedSessions()).thenReturn(completed);
        return row;
    }

    private CumulativeCountsRow countsRow(Long users, Long musics) {
        CumulativeCountsRow row = mock(CumulativeCountsRow.class);
        when(row.getUserCount()).thenReturn(users);
        when(row.getMusicCount()).thenReturn(musics);
        return row;
    }

    private ModeStatsRow modeRow(String mode, long n, long matchedN, Double p50, Double p95, Double max) {
        ModeStatsRow row = mock(ModeStatsRow.class);
        when(row.getMode()).thenReturn(mode);
        when(row.getN()).thenReturn(n);
        when(row.getMatchedN()).thenReturn(matchedN);
        when(row.getP50Ms()).thenReturn(p50);
        when(row.getP95Ms()).thenReturn(p95);
        when(row.getMaxMs()).thenReturn(max);
        return row;
    }

    @Test
    void days만큼_롤링_윈도로_조회한다() {
        stubEmpty();

        service.metrics(30);

        ArgumentCaptor<Instant> from = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> to = ArgumentCaptor.forClass(Instant.class);
        verify(adminStatsRepository).modeStats(from.capture(), to.capture());
        assertThat(Duration.between(from.getValue(), to.getValue())).isEqualTo(Duration.ofDays(30));
    }

    @Test
    void days_범위_밖은_거부한다() {
        assertThatThrownBy(() -> service.metrics(0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.metrics(91)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 빈_기간은_빈_배열과_null_pct_false_pass로_조립한다() {
        stubEmpty();

        MetricsResponse response = service.metrics(14);

        assertThat(response.periodDays()).isEqualTo(14);
        assertThat(response.kr2().targetMs()).isEqualTo(6000);
        assertThat(response.kr2().rows()).isEmpty();
        assertThat(response.kr2Breakdown()).isEmpty();
        assertThat(response.kr3().completionPct()).isNull();
        assertThat(response.kr3().pass()).isFalse();          // pct null → false (front 계약)
        assertThat(response.failures()).isEmpty();
        assertThat(response.weekly()).isEmpty();
        assertThat(response.totals().searchCount()).isZero();
        assertThat(response.totals().matchedCount()).isZero();
    }

    @Test
    void KR2는_행별_pass_KR3는_완료율로_판정한다() {
        stubEmpty();
        List<ModeStatsRow> modeRows = List.of(
                modeRow("fingerprint", 42, 38, 2100.0, 4800.0, 7200.0),
                modeRow("humming", 17, 11, 3900.0, 6100.0, 9100.0),
                modeRow(null, 59, 49, 2500.0, 5400.0, 9100.0)
        );
        CompletionRow completion = completionRow(31L, 12L);
        when(adminStatsRepository.modeStats(any(), any())).thenReturn(modeRows);
        when(adminStatsRepository.completion(any(), any())).thenReturn(completion);

        MetricsResponse response = service.metrics(14);

        assertThat(response.kr2().rows().get(0).pass()).isTrue();   // 4800 ≤ 6000
        assertThat(response.kr2().rows().get(1).pass()).isFalse();  // 6100 > 6000
        assertThat(response.kr2().rows().get(2).pass()).isTrue();   // 전체 5400
        assertThat(response.kr3().completionPct()).isEqualTo(38.7);
        assertThat(response.kr3().pass()).isFalse();                // 38.7 < 70
    }

    @Test
    void totals는_전체_롤업_행과_누적_카운트에서_온다() {
        stubEmpty();
        List<ModeStatsRow> modeRows = List.of(
                modeRow("fingerprint", 42, 38, 2100.0, 4800.0, 7200.0),
                modeRow(null, 59, 49, 2500.0, 5400.0, 9100.0)
        );
        CumulativeCountsRow counts = countsRow(8L, 133L);
        when(adminStatsRepository.modeStats(any(), any())).thenReturn(modeRows);
        when(adminStatsRepository.cumulativeCounts()).thenReturn(counts);

        MetricsResponse response = service.metrics(14);

        assertThat(response.totals().searchCount()).isEqualTo(59);
        assertThat(response.totals().matchedCount()).isEqualTo(49);
        assertThat(response.totals().userCount()).isEqualTo(8);
        assertThat(response.totals().musicCount()).isEqualTo(133);
    }
}
