package com.melolist.search.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.NotFoundException;
import com.melolist.music.domain.Music;
import com.melolist.music.repository.MusicRepository;
import com.melolist.search.domain.SearchHistory;
import com.melolist.search.dto.SearchHistoryResponse;
import com.melolist.search.repository.SearchHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 검색 기록 조회/삭제(M3, C4) — write는 SearchService가 검색 파이프라인에서 담당.
 * 기록은 항상 본인 것만 — 비소유 접근은 존재 노출을 피해 404로 답한다.
 */
@Service
@RequiredArgsConstructor
public class SearchHistoryService {

    private final SearchHistoryRepository searchHistoryRepository;
    private final MusicRepository musicRepository;

    @Transactional(readOnly = true)
    public PageResponse<SearchHistoryResponse> getPage(UUID userId, Pageable pageable) {
        Page<SearchHistory> page = searchHistoryRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable);
        // top 곡 스냅샷은 페이지 단위 일괄 조회 — 기록당 개별 조회(N+1) 방지
        Set<Long> musicIds = page.getContent().stream()
                .map(SearchHistory::getTopMusicId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, Music> musics = musicRepository.findAllById(musicIds).stream()
                .collect(Collectors.toMap(Music::getId, Function.identity()));
        return PageResponse.of(page, h -> SearchHistoryResponse.from(h, musics.get(h.getTopMusicId())));
    }

    @Transactional
    public void remove(UUID userId, Long id) {
        SearchHistory history = searchHistoryRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new NotFoundException("검색 기록을 찾을 수 없습니다."));
        searchHistoryRepository.delete(history);
    }
}
