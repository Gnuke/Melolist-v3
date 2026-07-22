package com.melolist.music.service;

import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.NotFoundException;
import com.melolist.music.domain.Music;
import com.melolist.music.dto.MusicResponse;
import com.melolist.music.dto.MusicUpsertCommand;
import com.melolist.music.repository.MusicRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MusicService {

    private final MusicRepository musicRepository;

    @Transactional(readOnly = true)
    public MusicResponse get(Long id) {
        Music music = musicRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("곡을 찾을 수 없습니다."));
        return MusicResponse.from(music);
    }

    /** 로컬 캐시(이미 인식된 곡) 대상 텍스트 검색 — 외부 카탈로그 조회 아님(PRD 부록 A.1). */
    @Transactional(readOnly = true)
    public PageResponse<MusicResponse> search(String query, Pageable pageable) {
        return PageResponse.of(
                musicRepository.findByTitleContainingIgnoreCaseOrArtistContainingIgnoreCase(query, query, pageable),
                MusicResponse::from
        );
    }

    /**
     * 인식 결과를 acrid 기준으로 upsert(eager 캐시). 기존 레코드가 있으면 비어 있던 필드를
     * 채운다 — 재검색으로 메타(videoId/cover)가 뒤늦게 확보되는 경우의 보강 경로.
     */
    @Transactional
    public Music upsertFromRecognition(MusicUpsertCommand cmd) {
        if (cmd.acrid() == null) {
            return musicRepository.save(newMusic(cmd));
        }
        return musicRepository.findByAcrid(cmd.acrid())
                .map(existing -> fillMissing(existing, cmd))
                .orElseGet(() -> insertNew(cmd));
    }

    private Music insertNew(MusicUpsertCommand cmd) {
        try {
            return musicRepository.save(newMusic(cmd));
        } catch (DataIntegrityViolationException e) {
            // 동시 검색이 같은 acrid를 먼저 넣은 경우 — 재조회로 수렴
            return musicRepository.findByAcrid(cmd.acrid())
                    .map(existing -> fillMissing(existing, cmd))
                    .orElseThrow(() -> e);
        }
    }

    private Music newMusic(MusicUpsertCommand cmd) {
        Music m = new Music();
        if (cmd.source() != null) {
            m.setSource(cmd.source());
        }
        m.setAcrid(cmd.acrid());
        m.setTitle(cmd.title());
        m.setArtist(cmd.artist());
        m.setAlbum(cmd.album());
        m.setReleaseDate(cmd.releaseDate());
        m.setDurationMs(cmd.durationMs());
        m.setYoutubeVideoId(cmd.youtubeVideoId());
        m.setCoverUrl(cmd.coverUrl());
        return m;
    }

    private Music fillMissing(Music existing, MusicUpsertCommand cmd) {
        if (existing.isMetaLocked()) {
            return existing; // 관리자 수동 정정 보호 — 자동 보강이 덮어쓰지 않는다(spec 003 FR-007)
        }
        if (existing.getYoutubeVideoId() == null && cmd.youtubeVideoId() != null) {
            existing.setYoutubeVideoId(cmd.youtubeVideoId());
        }
        if (existing.getCoverUrl() == null && cmd.coverUrl() != null) {
            existing.setCoverUrl(cmd.coverUrl());
        }
        if (existing.getReleaseDate() == null && cmd.releaseDate() != null) {
            existing.setReleaseDate(cmd.releaseDate());
        }
        if (existing.getDurationMs() == null && cmd.durationMs() != null) {
            existing.setDurationMs(cmd.durationMs());
        }
        if (existing.getAlbum() == null && cmd.album() != null) {
            existing.setAlbum(cmd.album());
        }
        return existing;
    }
}
