import { API_BASE_URL } from '@/lib/api'
import { getSessionId } from '@/features/events/session'
import { useAuthStore } from '@/stores/authStore'

/** backend-prd §6.1 이벤트 사전 + favorite_click(C6 게스트→가입 전환 원천) + 로그인 3종(spec 001 FR-009) */
export type EventType =
  | 'visit'
  | 'search_started'
  | 'search_result_shown'
  | 'search_failed'
  | 'favorite_click'
  | 'login_started'
  | 'login_succeeded'
  | 'login_failed'

export type SearchFailReason = 'bad_audio' | 'no_match' | 'low_score' | 'error' | 'timeout' | 'cancelled'

/**
 * 계측 이벤트 발화 — fire-and-forget. 실패해도 UX 영향 0, 재시도하지 않는다.
 * axios 대신 fetch(keepalive)를 쓴다: login_started처럼 발화 직후 전체 페이지
 * 이동(OAuth 리다이렉트)이 일어나도 전송이 유실되지 않는다. 같은 이유로 토큰도
 * 비동기 getSession() 대신 스토어에서 동기로 읽는다(없으면 게스트 이벤트로 기록).
 */
export function track(type: EventType, properties: Record<string, unknown> = {}): void {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Session-Id': getSessionId(),
  }
  const token = useAuthStore.getState().session?.access_token
  if (token) headers.Authorization = `Bearer ${token}`
  void fetch(`${API_BASE_URL}/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type, properties }),
    keepalive: true,
  }).catch(() => undefined)
}

const VISITED_KEY = 'melolist.visited'

/** visit은 세션당 정확히 1회 (KR3 분모). */
export function trackVisitOnce(): void {
  if (sessionStorage.getItem(VISITED_KEY)) return
  sessionStorage.setItem(VISITED_KEY, '1')
  track('visit', {
    referrer: document.referrer || null,
    is_mobile: /Mobi|Android/i.test(navigator.userAgent),
  })
}
