package com.melolist.community.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.community.domain.Favorite;
import com.melolist.music.dto.MusicResponse;

import java.time.Instant;

public final class FavoriteDtos {

    private FavoriteDtos() {
    }

    /**
     * 둘 중 하나 필수. 검색 결과 화면에는 musicId가 없어(upsert가 비동기 후처리라
     * 응답 시점 존재 보장도 안 됨) acrid로도 담을 수 있게 한다 — 검증은 서비스에서.
     */
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AddRequest(Long musicId, String acrid) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record FavoriteResponse(Long id, MusicResponse music, Instant createdAt) {

        public static FavoriteResponse from(Favorite f) {
            return new FavoriteResponse(f.getId(), MusicResponse.from(f.getMusic()), f.getCreatedAt());
        }
    }
}
