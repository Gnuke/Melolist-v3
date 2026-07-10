package com.melolist.community.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.melolist.community.domain.Favorite;
import com.melolist.music.dto.MusicResponse;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public final class FavoriteDtos {

    private FavoriteDtos() {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record AddRequest(@NotNull Long musicId) {
    }

    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public record FavoriteResponse(Long id, MusicResponse music, Instant createdAt) {

        public static FavoriteResponse from(Favorite f) {
            return new FavoriteResponse(f.getId(), MusicResponse.from(f.getMusic()), f.getCreatedAt());
        }
    }
}
