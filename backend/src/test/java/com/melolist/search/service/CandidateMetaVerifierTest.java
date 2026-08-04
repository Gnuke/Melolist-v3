package com.melolist.search.service;

import com.melolist.search.client.AcrMetadataClient;
import com.melolist.search.client.AiSongCandidate;
import com.melolist.search.client.MetaEnrichment;
import com.melolist.search.domain.SearchMode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 3단 메타 대조 + 동명이곡 오염 차단(spec 002에서 추출, spec 004 T002~T003) —
 * TextSearchService·DeepSearchService 공용 부품. 동작은 002와 동일해야 한다(추출 수용 기준).
 */
@ExtendWith(MockitoExtension.class)
class CandidateMetaVerifierTest {

    @Mock
    private AcrMetadataClient acrMetadataClient;

    private CandidateMetaVerifier verifier;

    @BeforeEach
    void setUp() {
        verifier = new CandidateMetaVerifier(acrMetadataClient, SearchMode.FINGERPRINT);
    }

    @Test
    void 일차_대조_성공이면_추가_조회_없이_반환한다() {
        when(acrMetadataClient.lookup(eq("좋은 날"), eq("아이유"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("jeqdYqsrsA0", null));

        MetaEnrichment result = verifier.lookupWithAltFallback(
                new AiSongCandidate("좋은 날", List.of("아이유"), null, "Good Day", "IU"));

        assertThat(result.verified()).isTrue();
        assertThat(result.youtubeVideoId()).isEqualTo("jeqdYqsrsA0");
        verify(acrMetadataClient, times(1)).lookup(anyString(), anyString(), any());
    }

    @Test
    void 일차_실패면_원제목과_로마자_아티스트로_이차_대조한다() {
        // ACR 최다 유형: 한글 제목 + 로마자 아티스트 등재(미소천사/Sung Si Kyung)
        when(acrMetadataClient.lookup(eq("미소천사"), eq("성시경"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);
        when(acrMetadataClient.lookup(eq("미소천사"), eq("Sung Si Kyung"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("ro1knsWzgjQ", null));

        MetaEnrichment result = verifier.lookupWithAltFallback(
                new AiSongCandidate("미소천사", List.of("성시경"), null, "Smile Angel", "Sung Si Kyung"));

        assertThat(result.verified()).isTrue();
        // ②에서 성공 — ③(영문 제목) 조회까지 가지 않는다
        verify(acrMetadataClient, never()).lookup(eq("Smile Angel"), anyString(), any());
    }

    @Test
    void 이차도_실패면_영문_제목으로_삼차_대조한다() {
        // 흔적→Trace 유형: 한글 곡의 영문 단독 등재
        when(acrMetadataClient.lookup(eq("흔적"), eq("윤종신"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);
        when(acrMetadataClient.lookup(eq("흔적"), eq("Yoon Jong Shin"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);
        when(acrMetadataClient.lookup(eq("Trace"), eq("Yoon Jong Shin"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("XPxqh7pzxHE", null));

        MetaEnrichment result = verifier.lookupWithAltFallback(
                new AiSongCandidate("흔적", List.of("윤종신"), null, "Trace", "Yoon Jong Shin"));

        assertThat(result.verified()).isTrue();
        assertThat(result.youtubeVideoId()).isEqualTo("XPxqh7pzxHE");
    }

    @Test
    void 영문_표기가_원표기와_같으면_중복_조회를_생략한다() {
        when(acrMetadataClient.lookup(eq("Dynamite"), eq("BTS"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);

        MetaEnrichment result = verifier.lookupWithAltFallback(
                new AiSongCandidate("Dynamite", List.of("BTS"), null, "dynamite", "BTS"));

        assertThat(result.verified()).isFalse();
        verify(acrMetadataClient, times(1)).lookup(anyString(), anyString(), any());
    }

    @Test
    void 반환_아티스트가_후보와_다르면_동명이곡_오염으로_미검증_처리한다() {
        when(acrMetadataClient.lookup(eq("흔적"), eq("윤종신"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("wrongVid0001", null, List.of("Yoon Jeong ah")));
        when(acrMetadataClient.lookup(eq("흔적"), eq("Yoon Jong Shin"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);

        MetaEnrichment result = verifier.lookupWithAltFallback(
                new AiSongCandidate("흔적", List.of("윤종신"), null, null, "Yoon Jong Shin"));

        assertThat(result.verified()).isFalse();
    }

    @Test
    void 반환_아티스트는_표기_변형을_흡수해_정규화_비교한다() {
        when(acrMetadataClient.lookup(eq("미소천사"), eq("성시경"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(MetaEnrichment.EMPTY);
        when(acrMetadataClient.lookup(eq("미소천사"), eq("Sung Si Kyung"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("ro1knsWzgjQ", null, List.of("SUNG SI-KYUNG")));

        MetaEnrichment result = verifier.lookupWithAltFallback(
                new AiSongCandidate("미소천사", List.of("성시경"), null, null, "Sung Si Kyung"));

        assertThat(result.verified()).isTrue();
    }

    @Test
    void 반환_아티스트가_없으면_비교_불가라_통과시킨다() {
        // mock 메타·구형 응답 호환 — 과잉 필터 방지
        when(acrMetadataClient.lookup(eq("좋은 날"), eq("아이유"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment("jeqdYqsrsA0", null));

        MetaEnrichment result = verifier.lookupWithAltFallback(
                new AiSongCandidate("좋은 날", List.of("아이유"), null));

        assertThat(result.verified()).isTrue();
    }

    @Test
    void 커버만_있어도_실존_확인으로_본다() {
        when(acrMetadataClient.lookup(eq("Old Song"), eq("Artist"), eq(SearchMode.FINGERPRINT)))
                .thenReturn(new MetaEnrichment(null, "https://cover/medium.jpg"));

        MetaEnrichment result = verifier.lookupWithAltFallback(
                new AiSongCandidate("Old Song", List.of("Artist"), null));

        assertThat(result.verified()).isTrue();
        assertThat(result.coverUrlOrFallback()).isEqualTo("https://cover/medium.jpg");
    }
}
