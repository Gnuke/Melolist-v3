package com.melolist.search.client;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 웹 근거 링크 → 유튜브 videoId 추출·검증(spec 004 R5). LLM이 웹검색으로 찾은 URL을
 * 오전사하거나 타 도메인 링크를 낼 수 있어, §5.2 규칙(유튜브 계열 도메인 + 11자 ID
 * 패턴)을 통과한 값만 저장 경로에 태운다. 불일치는 null — 후보는 링크 없는 미확인 유지.
 */
public final class YoutubeLinks {

    private static final Pattern VIDEO_ID = Pattern.compile("^[A-Za-z0-9_-]{11}$");

    private YoutubeLinks() {
    }

    /** URL(watch·youtu.be·shorts·music/m 서브도메인) 또는 순수 11자 ID를 수용, 그 외 null. */
    public static String extractVideoId(String linkOrId) {
        if (linkOrId == null || linkOrId.isBlank()) {
            return null;
        }
        String value = linkOrId.trim();
        if (VIDEO_ID.matcher(value).matches()) {
            return value;
        }

        URI uri;
        try {
            uri = URI.create(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
        String host = uri.getHost();
        if (host == null) {
            return null;
        }
        host = host.toLowerCase(Locale.ROOT);

        String candidate = null;
        if (host.equals("youtu.be")) {
            candidate = firstPathSegment(uri);
        } else if (host.equals("youtube.com") || host.endsWith(".youtube.com")) {
            String path = uri.getPath() == null ? "" : uri.getPath();
            if (path.startsWith("/watch")) {
                candidate = queryParam(uri, "v");
            } else if (path.startsWith("/shorts/") || path.startsWith("/embed/")) {
                candidate = path.substring(path.indexOf('/', 1) + 1);
                int slash = candidate.indexOf('/');
                if (slash >= 0) {
                    candidate = candidate.substring(0, slash);
                }
            }
        }
        return candidate != null && VIDEO_ID.matcher(candidate).matches() ? candidate : null;
    }

    private static String firstPathSegment(URI uri) {
        String path = uri.getPath();
        if (path == null || path.length() <= 1) {
            return null;
        }
        String segment = path.substring(1);
        int slash = segment.indexOf('/');
        return slash >= 0 ? segment.substring(0, slash) : segment;
    }

    private static String queryParam(URI uri, String name) {
        String query = uri.getRawQuery();
        if (query == null) {
            return null;
        }
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq > 0 && pair.substring(0, eq).equals(name)) {
                return pair.substring(eq + 1);
            }
        }
        return null;
    }
}
