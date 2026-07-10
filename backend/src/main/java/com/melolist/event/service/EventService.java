package com.melolist.event.service;

import com.melolist.event.domain.EventLog;
import com.melolist.event.repository.EventLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class EventService {

    private final EventLogRepository eventLogRepository;

    @Transactional
    public void record(String type, UUID sessionId, UUID userId, Map<String, Object> properties) {
        eventLogRepository.save(new EventLog(type, sessionId, userId, properties));
    }

    /**
     * 검색 파이프라인 등 다른 흐름 안에서 쓰는 기록 — 계측 실패가 본 응답을 깨면 안 되므로
     * 예외를 삼키고 로그만 남긴다. 별도 트랜잭션(REQUIRES_NEW)으로 본 트랜잭션 오염도 방지.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSilently(String type, UUID sessionId, UUID userId, Map<String, Object> properties) {
        try {
            eventLogRepository.save(new EventLog(type, sessionId, userId, properties));
        } catch (Exception e) {
            log.warn("이벤트 기록 실패: type={}", type, e);
        }
    }
}
