package com.melolist.music.web;

import com.melolist.common.dto.PageResponse;
import com.melolist.music.dto.MusicResponse;
import com.melolist.music.service.MusicService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 곡 조회 — 게스트 허용(PRD §5.3). 데이터 출처는 인식 결과 캐시(MUSIC)뿐이므로
 * 텍스트 검색도 로컬 캐시 조회다.
 */
@RestController
@RequestMapping("/api/music")
@RequiredArgsConstructor
public class MusicController {

    private final MusicService musicService;

    @GetMapping("/{id}")
    public MusicResponse get(@PathVariable Long id) {
        return musicService.get(id);
    }

    @GetMapping
    public PageResponse<MusicResponse> search(
            @RequestParam String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return musicService.search(query, PageRequest.of(page, Math.min(size, 50)));
    }
}
