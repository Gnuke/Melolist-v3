package com.melolist.admin.repository;

import com.melolist.music.domain.Music;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * 어드민 곡 관리 전용 조회(research D4) — 공용 MusicRepository는 수정하지 않는다.
 */
public interface AdminMusicRepository extends Repository<Music, Long> {

    /**
     * 목록(front 계약 §2) — query(제목·아티스트 부분일치)·missing(video|cover) 조합 필터,
     * created_at 내림차순 고정. 미지정 필터는 null이 아닌 빈 문자열로 받는다 —
     * null 바인딩은 PostgreSQL이 concat 파라미터 타입을 추론하지 못해 실패한다.
     */
    @Query("""
            select m from Music m
            where (:query = ''
                   or lower(m.title) like lower(concat('%', :query, '%'))
                   or lower(m.artist) like lower(concat('%', :query, '%')))
              and (:missing = ''
                   or (:missing = 'video' and m.youtubeVideoId is null)
                   or (:missing = 'cover' and m.coverUrl is null))
            order by m.createdAt desc
            """)
    Page<Music> search(@Param("query") String query, @Param("missing") String missing, Pageable pageable);

    interface ReferenceCountRow {
        Long getFavoriteCount();

        Long getPlaylistItemCount();

        Long getHistoryCount();
    }

    /** 삭제 차단 판단용 참조 집계(research D8) — favorite·playlist_music·search_history. */
    @Query(value = """
            select (select count(*) from favorite where music_id = :musicId)           as "favoriteCount",
                   (select count(*) from playlist_music where music_id = :musicId)     as "playlistItemCount",
                   (select count(*) from search_history where top_music_id = :musicId) as "historyCount"
            """, nativeQuery = true)
    ReferenceCountRow countReferences(@Param("musicId") Long musicId);
}
