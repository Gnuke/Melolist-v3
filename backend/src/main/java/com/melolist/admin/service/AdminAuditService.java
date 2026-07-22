package com.melolist.admin.service;

import com.melolist.admin.domain.AdminAuditLog;
import com.melolist.admin.repository.AdminAuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * 관리자 변경 작업 감사 기록(spec 003 FR-011).
 * MANDATORY 전파로 호출자 트랜잭션 참여를 강제한다 — 변경과 기록이 원자적으로
 * 함께 커밋·롤백되어 누락 0건(SC-004)이 구조적으로 보장된다(research D5).
 */
@Service
@RequiredArgsConstructor
public class AdminAuditService {

    private final AdminAuditLogRepository adminAuditLogRepository;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(UUID adminId, String action, String targetType, String targetId,
                       Map<String, Object> before, Map<String, Object> after) {
        Map<String, Object> detail = new LinkedHashMap<>();
        if (before != null) {
            detail.put("before", before);
        }
        if (after != null) {
            detail.put("after", after);
        }
        adminAuditLogRepository.save(new AdminAuditLog(adminId, action, targetType, targetId, detail));
    }
}
