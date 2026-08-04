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

/**
 * 폴백 화면 스태시(spec 004) — 게스트가 "더 깊이 찾기"를 눌러 로그인으로 떠날 때
 * AI 폴백 맥락(진입 경로·질의·복귀용 원래 결과)을 보관, 로그인 복귀 시 폴백 화면과
 * 질의를 그대로 복원한다(US1 AS-5).
 */
const FALLBACK_KEY = 'melolist.fallback-stash'

interface FallbackStash {
  mode: SearchType
  from: 'no_match' | 'mismatch'
  query: string
  back: { results: AcrResult[]; lowScore: boolean } | null
  at: number
}

export function stashFallback(
  mode: SearchType,
  from: 'no_match' | 'mismatch',
  query: string,
  back: { results: AcrResult[]; lowScore: boolean } | null,
): void {
  const stash: FallbackStash = { mode, from, query, back, at: Date.now() }
  sessionStorage.setItem(FALLBACK_KEY, JSON.stringify(stash))
}

export function peekStashedFallback(
  mode: SearchType,
): { from: 'no_match' | 'mismatch'; query: string; back: { results: AcrResult[]; lowScore: boolean } | null } | null {
  const raw = sessionStorage.getItem(FALLBACK_KEY)
  if (!raw) return null
  try {
    const stash = JSON.parse(raw) as Partial<FallbackStash>
    if (
      stash.mode !== mode ||
      typeof stash.at !== 'number' ||
      Date.now() - stash.at > TTL_MS ||
      (stash.from !== 'no_match' && stash.from !== 'mismatch') ||
      typeof stash.query !== 'string'
    ) {
      return null
    }
    return { from: stash.from, query: stash.query, back: stash.back ?? null }
  } catch {
    return null
  }
}

export function clearStashedFallback(): void {
  sessionStorage.removeItem(FALLBACK_KEY)
}
