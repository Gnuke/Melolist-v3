package com.melolist.admin.web;

import com.melolist.admin.dto.AdminMetricsDtos.MetricsResponse;
import com.melolist.admin.service.AdminMetricsService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 운영 지표 대시보드(front 계약 §1). 인가는 AdminAuthInterceptor가 경로 단위로 수행.
 * days 기본 14, 허용 1~90 — 범위 밖은 400 INVALID_ARGUMENT.
 */
@RestController
@RequestMapping("/api/admin/metrics")
@RequiredArgsConstructor
public class AdminMetricsController {

    private final AdminMetricsService adminMetricsService;

    @GetMapping
    public MetricsResponse metrics(@RequestParam(defaultValue = "14") int days) {
        return adminMetricsService.metrics(days);
    }
}
