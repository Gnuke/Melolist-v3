package com.melolist.music.repository;

import com.melolist.music.domain.Music;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MusicRepository extends JpaRepository<Music, Long> {

    Optional<Music> findByAcrid(String acrid);

    /** 텍스트 검색은 외부가 아닌 로컬 캐시(이미 인식된 곡) 대상이다(PRD 부록 A.1). */
    Page<Music> findByTitleContainingIgnoreCaseOrArtistContainingIgnoreCase(
            String title, String artist, Pageable pageable);
}
