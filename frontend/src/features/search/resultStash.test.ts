import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  stashResults,
  peekStashedResults,
  clearStashedResults,
  stashFallback,
  peekStashedFallback,
  clearStashedFallback,
} from './resultStash'
import type { AcrResult } from './types'

const KEY = 'melolist.search-results-stash'
const TTL_MS = 10 * 60_000

const song: AcrResult = {
  acrid: 'acr-1',
  title: '벚꽃엔딩',
  artists: [{ name: '버스커버스커' }],
  score: 0.94,
}

describe('resultStash', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('스태시한 결과를 같은 모드로 다시 읽을 수 있다', () => {
    stashResults('humming', [song], false)

    const restored = peekStashedResults('humming')

    expect(restored).toEqual({ results: [song], lowScore: false })
  })

  it('lowScore 플래그가 보존된다', () => {
    stashResults('humming', [song], true)

    expect(peekStashedResults('humming')?.lowScore).toBe(true)
  })

  it('다른 모드로 스태시한 결과는 복원하지 않는다', () => {
    stashResults('fingerprint', [song], false)

    expect(peekStashedResults('humming')).toBeNull()
  })

  it('TTL(10분)이 지난 스태시는 복원하지 않는다', () => {
    vi.useFakeTimers()
    stashResults('humming', [song], false)

    vi.advanceTimersByTime(TTL_MS + 1)

    expect(peekStashedResults('humming')).toBeNull()
  })

  it('TTL 직전까지는 복원한다', () => {
    vi.useFakeTimers()
    stashResults('humming', [song], false)

    vi.advanceTimersByTime(TTL_MS)

    expect(peekStashedResults('humming')).not.toBeNull()
  })

  it('peek은 스태시를 지우지 않는다 — StrictMode 이중 렌더에도 두 번째 읽기가 성공한다', () => {
    stashResults('humming', [song], false)

    peekStashedResults('humming')

    expect(peekStashedResults('humming')).not.toBeNull()
  })

  it('빈 결과 배열은 복원하지 않는다', () => {
    stashResults('humming', [], false)

    expect(peekStashedResults('humming')).toBeNull()
  })

  it('스태시가 없으면 null을 반환한다', () => {
    expect(peekStashedResults('humming')).toBeNull()
  })

  it('깨진 JSON이 저장돼 있어도 예외 없이 null을 반환한다', () => {
    sessionStorage.setItem(KEY, '{not-json')

    expect(peekStashedResults('humming')).toBeNull()
  })

  it('at이 숫자가 아니면 복원하지 않는다', () => {
    sessionStorage.setItem(KEY, JSON.stringify({ mode: 'humming', results: [song], lowScore: false, at: 'yesterday' }))

    expect(peekStashedResults('humming')).toBeNull()
  })

  it('clearStashedResults 후에는 복원되지 않는다', () => {
    stashResults('humming', [song], false)

    clearStashedResults()

    expect(peekStashedResults('humming')).toBeNull()
  })
})

describe('fallbackStash (spec 004 — 게스트 심층 탐색 로그인 복귀)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('폴백 맥락(진입 경로·질의·복귀 결과)을 같은 모드로 복원한다', () => {
    stashFallback('humming', 'mismatch', '성시경 노랜데 댄스곡', { results: [song], lowScore: false })

    const restored = peekStashedFallback('humming')

    expect(restored).toEqual({
      from: 'mismatch',
      query: '성시경 노랜데 댄스곡',
      back: { results: [song], lowScore: false },
    })
  })

  it('back이 없는 무결과 진입도 보존한다', () => {
    stashFallback('humming', 'no_match', '어떤 신곡', null)

    expect(peekStashedFallback('humming')).toEqual({ from: 'no_match', query: '어떤 신곡', back: null })
  })

  it('다른 모드로 스태시한 폴백은 복원하지 않는다', () => {
    stashFallback('fingerprint', 'no_match', 'q', null)

    expect(peekStashedFallback('humming')).toBeNull()
  })

  it('TTL(10분)이 지난 폴백 스태시는 복원하지 않는다', () => {
    vi.useFakeTimers()
    stashFallback('humming', 'no_match', 'q', null)

    vi.advanceTimersByTime(10 * 60_000 + 1)

    expect(peekStashedFallback('humming')).toBeNull()
  })

  it('clearStashedFallback 후에는 복원되지 않는다', () => {
    stashFallback('humming', 'no_match', 'q', null)

    clearStashedFallback()

    expect(peekStashedFallback('humming')).toBeNull()
  })
})
