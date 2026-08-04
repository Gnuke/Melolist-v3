package com.melolist.search.service;

import com.melolist.search.client.AcrMetadataClient;
import com.melolist.search.client.AiSongCandidate;
import com.melolist.search.client.MetaEnrichment;
import com.melolist.search.domain.SearchMode;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;

/**
 * 후보 곡의 카탈로그 메타 대조(spec 002에서 추출 — TextSearchService·DeepSearchService 공용).
 *
 * <p>표기 혼재 대응 3단 체인(전부 실측 유형, 성공 즉시 중단·null/동일 조합 생략):
 * ① 원표기 → ② 원제목+로마자 아티스트(최다 유형 — ACR 아티스트 로마자 우세)
 * → ③ 영문 제목+로마자 아티스트. 여기에 동명이곡 오염 차단(반환 아티스트 정규화 비교)을
 * 겹친다. 스프링 빈이 아니다 — 각 서비스가 자기 조회 모드로 직접 생성한다(002 테스트
 * 생성자 호환 유지).</p>
 */
@Slf4j
public class CandidateMetaVerifier {

    private final AcrMetadataClient acrMetadataClient;
    private final SearchMode lookupMode;

    public CandidateMetaVerifier(AcrMetadataClient acrMetadataClient, SearchMode lookupMode) {
        this.acrMetadataClient = acrMetadataClient;
        this.lookupMode = lookupMode;
    }

    /** 전부 실패하는 후보는 최대 3회 조회라 소요가 늘어난다 — 데드라인 컷은 호출자 책임. */
    public MetaEnrichment lookupWithAltFallback(AiSongCandidate c) {
        MetaEnrichment result = accept(c, acrMetadataClient.lookup(c.title(), c.firstArtist(), lookupMode));
        if (result.verified()) {
            return result;
        }

        String artist = c.firstArtist();
        String artistAlt = normalized(c.artistAlt());
        String titleAlt = normalized(c.titleAlt());

        if (artistAlt != null && (artist == null || !artistAlt.equalsIgnoreCase(artist))) {
            result = accept(c, acrMetadataClient.lookup(c.title(), artistAlt, lookupMode));
            if (result.verified()) {
                return result;
            }
        }
        if (titleAlt != null && !titleAlt.equalsIgnoreCase(c.title())) {
            result = accept(c, acrMetadataClient.lookup(titleAlt, artistAlt != null ? artistAlt : artist, lookupMode));
        }
        return result;
    }

    /**
     * fuzzy 대조가 다른 가수의 동명곡을 반환하는 오염 차단(실측: 흔적/Yoon Jong Shin 요청에
     * 윤정아 동명곡 반환) — 반환 아티스트가 후보의 어떤 표기와도 안 맞으면 미검증 처리.
     * 반환 아티스트가 없으면 비교 불가라 통과(과잉 필터 방지, mock 포함).
     */
    private MetaEnrichment accept(AiSongCandidate c, MetaEnrichment meta) {
        if (meta.verified() && !artistMatches(c, meta)) {
            log.info("메타 대조 동명이곡 의심 — 후보 {}/{} vs 반환 아티스트 {}",
                    c.title(), c.joinedArtists(), meta.artists());
            return MetaEnrichment.EMPTY;
        }
        return meta;
    }

    private static boolean artistMatches(AiSongCandidate c, MetaEnrichment meta) {
        if (meta.artists() == null || meta.artists().isEmpty()) {
            return true;
        }
        List<String> expected = new ArrayList<>();
        if (c.artists() != null) {
            expected.addAll(c.artists());
        }
        if (c.artistAlt() != null) {
            expected.add(c.artistAlt());
        }
        if (expected.isEmpty()) {
            return true;
        }
        for (String returned : meta.artists()) {
            String r = normalizeName(returned);
            if (r.isEmpty()) {
                continue;
            }
            for (String e : expected) {
                String n = normalizeName(e);
                if (!n.isEmpty() && (n.equals(r) || n.contains(r) || r.contains(n))) {
                    return true;
                }
            }
        }
        return false;
    }

    /** 표기 변형(대소문자·공백·하이픈·마침표) 흡수용 정규화. */
    private static String normalizeName(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[\\s\\-._]", "");
    }

    private static String normalized(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
