package com.melolist.admin.service;

import com.melolist.admin.domain.AdminAuditLog;
import com.melolist.admin.dto.AdminMusicDtos.MusicAdminItem;
import com.melolist.admin.dto.AdminMusicDtos.MusicDetail;
import com.melolist.admin.dto.AdminMusicDtos.References;
import com.melolist.admin.dto.AdminMusicDtos.UpdateRequest;
import com.melolist.admin.error.InvalidAdminArgumentException;
import com.melolist.admin.repository.AdminMusicRepository;
import com.melolist.common.dto.PageResponse;
import com.melolist.common.error.ConflictException;
import com.melolist.common.error.NotFoundException;
import com.melolist.music.domain.Music;
import com.melolist.music.repository.MusicRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * MUSIC 캐시 관리(US2, front 계약 §2·§3). 수정은 부분 수정(담긴 필드만, 빈 문자열=비우기)이며
 * 성공 시 meta_locked 잠금으로 자동 보강에서 보호된다(FR-007). 삭제는 사용자 저장이 참조하면
 * 차단(FR-008). 모든 변경은 감사 기록과 같은 트랜잭션이다(FR-011).
 */
@Service
@RequiredArgsConstructor
public class AdminMusicService {

    private static final String TARGET_TYPE = "MUSIC";
    /** ytimg 폴백 체인의 전제 형식 — 11자 고정(front 계약 §3). */
    private static final Pattern VIDEO_ID = Pattern.compile("^[A-Za-z0-9_-]{11}$");
    private static final Pattern HTTP_URL = Pattern.compile("^https?://.+");
    private static final int MAX_TEXT = 255;
    private static final int MAX_URL = 2048;

    private final MusicRepository musicRepository;
    private final AdminMusicRepository adminMusicRepository;
    private final AdminAuditService adminAuditService;

    @Transactional(readOnly = true)
    public PageResponse<MusicAdminItem> list(String query, String missing, Pageable pageable) {
        if (missing != null && !missing.isBlank() && !"video".equals(missing) && !"cover".equals(missing)) {
            throw new InvalidAdminArgumentException("missing", "missing은 video 또는 cover만 허용됩니다.");
        }
        // 미지정 필터는 빈 문자열 센티널 — null 바인딩의 PostgreSQL 타입 추론 실패 회피(repository 주석)
        String normalizedQuery = (query == null || query.isBlank()) ? "" : query.trim();
        String normalizedMissing = (missing == null || missing.isBlank()) ? "" : missing;
        return PageResponse.of(
                adminMusicRepository.search(normalizedQuery, normalizedMissing, pageable),
                MusicAdminItem::from
        );
    }

    @Transactional(readOnly = true)
    public MusicDetail get(Long id) {
        Music music = find(id);
        return MusicDetail.of(music, references(id));
    }

    /** 부분 수정 — null(미포함)=미변경, 빈 문자열=비우기(front 계약 §3). */
    @Transactional
    public MusicAdminItem update(UUID adminId, Long id, UpdateRequest request) {
        Music music = find(id);
        Map<String, Object> before = snapshot(music);

        if (request.title() != null) {
            String title = request.title().trim();
            if (title.isEmpty()) {
                throw new InvalidAdminArgumentException("title", "title은 비울 수 없습니다.");
            }
            music.setTitle(requireMaxLength("title", title, MAX_TEXT));
        }
        if (request.artist() != null) {
            music.setArtist(emptyToNull(requireMaxLength("artist", request.artist().trim(), MAX_TEXT)));
        }
        if (request.album() != null) {
            music.setAlbum(emptyToNull(requireMaxLength("album", request.album().trim(), MAX_TEXT)));
        }
        if (request.releaseDate() != null) {
            music.setReleaseDate(parseReleaseDate(request.releaseDate().trim()));
        }
        if (request.youtubeVideoId() != null) {
            String videoId = request.youtubeVideoId().trim();
            if (!videoId.isEmpty() && !VIDEO_ID.matcher(videoId).matches()) {
                throw new InvalidAdminArgumentException("youtube_video_id", "유튜브 영상 ID 형식이 아닙니다(11자).");
            }
            music.setYoutubeVideoId(emptyToNull(videoId));
        }
        if (request.coverUrl() != null) {
            String coverUrl = request.coverUrl().trim();
            if (!coverUrl.isEmpty()
                    && (coverUrl.length() > MAX_URL || !HTTP_URL.matcher(coverUrl).matches())) {
                throw new InvalidAdminArgumentException("cover_url", "http(s) URL 문자열만 허용됩니다.");
            }
            music.setCoverUrl(emptyToNull(coverUrl));
        }
        music.setMetaLocked(true);

        adminAuditService.record(adminId, AdminAuditLog.ACTION_MUSIC_UPDATE, TARGET_TYPE,
                String.valueOf(id), before, snapshot(music));
        return MusicAdminItem.from(music);
    }

    @Transactional
    public void delete(UUID adminId, Long id) {
        Music music = find(id);
        References references = references(id);
        if (references.any()) {
            throw new ConflictException(
                    "참조 중인 곡은 삭제할 수 없습니다. (즐겨찾기 %d·플레이리스트 %d·검색기록 %d) — 삭제 대신 곡 정보 정정을 사용하세요."
                            .formatted(references.favoriteCount(), references.playlistItemCount(),
                                    references.historyCount()));
        }
        Map<String, Object> before = snapshot(music);
        musicRepository.delete(music);
        adminAuditService.record(adminId, AdminAuditLog.ACTION_MUSIC_DELETE, TARGET_TYPE,
                String.valueOf(id), before, null);
    }

    private Music find(Long id) {
        return musicRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("곡을 찾을 수 없습니다."));
    }

    private References references(Long id) {
        AdminMusicRepository.ReferenceCountRow row = adminMusicRepository.countReferences(id);
        return new References(zero(row.getFavoriteCount()), zero(row.getPlaylistItemCount()),
                zero(row.getHistoryCount()));
    }

    private long zero(Long value) {
        return value == null ? 0L : value;
    }

    private String emptyToNull(String value) {
        return value.isEmpty() ? null : value;
    }

    private String requireMaxLength(String field, String value, int max) {
        if (value.length() > max) {
            throw new InvalidAdminArgumentException(field, "%s은(는) %d자를 넘을 수 없습니다.".formatted(field, max));
        }
        return value;
    }

    private LocalDate parseReleaseDate(String value) {
        if (value.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new InvalidAdminArgumentException("release_date", "ISO 날짜 형식(YYYY-MM-DD)이어야 합니다.");
        }
    }

    /** 감사 detail 스냅샷 — 계약 필드만(data-model §1). */
    private Map<String, Object> snapshot(Music m) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("title", m.getTitle());
        map.put("artist", m.getArtist());
        map.put("album", m.getAlbum());
        map.put("release_date", m.getReleaseDate() == null ? null : m.getReleaseDate().toString());
        map.put("youtube_video_id", m.getYoutubeVideoId());
        map.put("cover_url", m.getCoverUrl());
        map.put("meta_locked", m.isMetaLocked());
        return map;
    }
}
