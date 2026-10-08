import { beforeEach, describe, expect, it } from 'vitest'
import { markReviewPromptShown, shouldCheckReviewPrompt } from './reviewPrompt'

describe('리뷰 유도 게이트(spec 005 FR-010)', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('게스트에게는 판정을 조회하지 않는다', () => {
    expect(shouldCheckReviewPrompt({ loggedIn: false, restored: false })).toBe(false)
  })

  it('복원 진입(이미 본 결과)에서는 조회하지 않는다', () => {
    expect(shouldCheckReviewPrompt({ loggedIn: true, restored: true })).toBe(false)
  })

  it('로그인·비복원 첫 결과에서는 조회한다', () => {
    expect(shouldCheckReviewPrompt({ loggedIn: true, restored: false })).toBe(true)
  })

  it('한 번 노출되면 같은 세션에서는 다시 조회하지 않는다 — 선택 없이 닫아도 유지', () => {
    markReviewPromptShown()

    expect(shouldCheckReviewPrompt({ loggedIn: true, restored: false })).toBe(false)
  })
})
