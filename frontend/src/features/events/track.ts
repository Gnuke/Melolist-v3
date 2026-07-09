import { api } from '@/lib/api'

/** backend-prd §6.1 이벤트 사전 + favorite_click(C6 게스트→가입 전환 원천) */
export type EventType =
  | 'visit'
  | 'search_started'
  | 'search_result_shown'
  | 'search_failed'
  | 'favorite_click'

export type SearchFailReason = 'bad_audio' | 'no_match' | 'low_score' | 'error'

/** 계측 이벤트 발화 — fire-and-forget. 실패해도 UX 영향 0, 재시도하지 않는다. */
export function track(type: EventType, properties: Record<string, unknown> = {}): void {
  void api.post('/events', { type, properties }).catch(() => undefined)
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
