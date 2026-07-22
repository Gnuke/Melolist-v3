package com.melolist.admin.repository;

import com.melolist.admin.domain.AdminAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;

/** 감사 기록 저장 전용 — 조회 API는 후속 범위(FR-011은 기록만 의무). */
public interface AdminAuditLogRepository extends JpaRepository<AdminAuditLog, Long> {
}
