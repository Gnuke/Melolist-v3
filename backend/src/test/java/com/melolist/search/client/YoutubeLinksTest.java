package com.melolist.search.client;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 웹 근거 링크의 videoId 추출·검증(spec 004 R5, §5.2 규칙) — 유튜브 계열만 수용,
 * ID는 11자 패턴. 불일치는 null(후보는 링크 없는 미확인으로 유지).
 */
class YoutubeLinksTest {

    @Test
    void watch_URL에서_videoId를_추출한다() {
        assertThat(YoutubeLinks.extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
                .isEqualTo("dQw4w9WgXcQ");
    }

    @Test
    void 추가_쿼리_파라미터가_있어도_추출한다() {
        assertThat(YoutubeLinks.extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123"))
                .isEqualTo("dQw4w9WgXcQ");
        assertThat(YoutubeLinks.extractVideoId("https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ"))
                .isEqualTo("dQw4w9WgXcQ");
    }

    @Test
    void youtu_be_단축_URL을_수용한다() {
        assertThat(YoutubeLinks.extractVideoId("https://youtu.be/dQw4w9WgXcQ"))
                .isEqualTo("dQw4w9WgXcQ");
        assertThat(YoutubeLinks.extractVideoId("https://youtu.be/dQw4w9WgXcQ?si=abc"))
                .isEqualTo("dQw4w9WgXcQ");
    }

    @Test
    void shorts_와_music_도메인_URL을_수용한다() {
        assertThat(YoutubeLinks.extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"))
                .isEqualTo("dQw4w9WgXcQ");
        assertThat(YoutubeLinks.extractVideoId("https://music.youtube.com/watch?v=dQw4w9WgXcQ"))
                .isEqualTo("dQw4w9WgXcQ");
        assertThat(YoutubeLinks.extractVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ"))
                .isEqualTo("dQw4w9WgXcQ");
    }

    @Test
    void 순수_11자_ID는_그대로_수용한다() {
        assertThat(YoutubeLinks.extractVideoId("dQw4w9WgXcQ")).isEqualTo("dQw4w9WgXcQ");
    }

    @Test
    void 비유튜브_도메인은_거부한다() {
        assertThat(YoutubeLinks.extractVideoId("https://evil.example.com/watch?v=dQw4w9WgXcQ")).isNull();
        assertThat(YoutubeLinks.extractVideoId("https://vimeo.com/12345678901")).isNull();
        assertThat(YoutubeLinks.extractVideoId("https://notyoutube.com/watch?v=dQw4w9WgXcQ")).isNull();
    }

    @Test
    void 불량_ID_패턴은_거부한다() {
        assertThat(YoutubeLinks.extractVideoId("https://www.youtube.com/watch?v=short")).isNull();
        assertThat(YoutubeLinks.extractVideoId("https://www.youtube.com/watch?v=too-long-video-id")).isNull();
        assertThat(YoutubeLinks.extractVideoId("has spaces!")).isNull();
    }

    @Test
    void null_또는_빈값은_null이다() {
        assertThat(YoutubeLinks.extractVideoId(null)).isNull();
        assertThat(YoutubeLinks.extractVideoId("  ")).isNull();
    }
}
