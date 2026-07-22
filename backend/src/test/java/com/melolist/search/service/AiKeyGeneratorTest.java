package com.melolist.search.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AiKeyGeneratorTest {

    @Test
    void 같은_곡은_표기가_달라도_같은_키가_나온다() {
        String a = AiKeyGenerator.keyOf("좋은 날", "아이유");
        String b = AiKeyGenerator.keyOf("  좋은  날 ", "아이유 ");
        String c = AiKeyGenerator.keyOf("좋은 날", "아이유");
        assertThat(a).isEqualTo(b).isEqualTo(c);
    }

    @Test
    void 대소문자는_구분하지_않는다() {
        assertThat(AiKeyGenerator.keyOf("Ditto", "NewJeans"))
                .isEqualTo(AiKeyGenerator.keyOf("ditto", "newjeans"));
    }

    @Test
    void 다른_곡은_다른_키가_나온다() {
        assertThat(AiKeyGenerator.keyOf("좋은 날", "아이유"))
                .isNotEqualTo(AiKeyGenerator.keyOf("밤편지", "아이유"))
                .isNotEqualTo(AiKeyGenerator.keyOf("좋은 날", "다른가수"));
    }

    @Test
    void 키_형식은_ai_접두와_16자리_hex다() {
        String key = AiKeyGenerator.keyOf("Dynamite", "BTS");
        assertThat(key).matches("^ai-[0-9a-f]{16}$");
        assertThat(key).hasSize(19);
        assertThat(AiKeyGenerator.isAiKey(key)).isTrue();
        assertThat(AiKeyGenerator.isAiKey("mock-good-day")).isFalse();
    }

    @Test
    void 아티스트가_null이어도_동작한다() {
        assertThat(AiKeyGenerator.keyOf("무명곡", null)).matches("^ai-[0-9a-f]{16}$");
    }
}
