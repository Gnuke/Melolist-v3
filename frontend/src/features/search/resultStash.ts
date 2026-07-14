import type { AcrResult, SearchType } from './types'

/**
 * 검색 결과 스태시 — ♡ 로그인 유도로 화면을 떠날 때 결과를 sessionStorage에
 * 보관했다가, OAuth 복귀로 SearchPage가 다시 마운트될 때 복원한다(FR-004 맥락 복귀).
 * OAuth는 전체 페이지 리다이렉트라 리액트 상태가 소실되기 때문에 필요하다.
 */
const KEY = 'melolist.search-results-stash'

/** Google 계정 선택·2단계 인증까지 감안한 왕복 허용 시간 */
const TTL_MS = 10 * 60_000

interface Stash {
  mode: SearchType
  results: AcrResult[]
  lowScore: boolean
  at: number
}

export function stashResults(mode: SearchType, results: AcrResult[], lowScore: boolean): void {
  const stash: Stash = { mode, results, lowScore, at: Date.now() }
  sessionStorage.setItem(KEY, JSON.stringify(stash))
}

/** 읽기 전용 조회 — StrictMode 이중 렌더에 안전하도록 제거는 clearStashedResults()로 분리. */
export function peekStashedResults(mode: SearchType): { results: AcrResult[]; lowScore: boolean } | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    const stash = JSON.parse(raw) as Partial<Stash>
    if (
      stash.mode !== mode ||
      typeof stash.at !== 'number' ||
      Date.now() - stash.at > TTL_MS ||
      !Array.isArray(stash.results) ||
      stash.results.length === 0
    ) {
      return null
    }
    return { results: stash.results, lowScore: !!stash.lowScore }
  } catch {
    return null
  }
}

export function clearStashedResults(): void {
  sessionStorage.removeItem(KEY)
}
