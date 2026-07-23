import { beforeEach, describe, expect, it } from 'vitest'
import { getSessionId } from './session'

describe('getSessionId', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('UUID 형식의 세션 ID를 생성하고 sessionStorage에 저장한다', () => {
    const id = getSessionId()

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(sessionStorage.getItem('melolist.session-id')).toBe(id)
  })

  it('같은 세션에서는 항상 같은 ID를 반환한다', () => {
    expect(getSessionId()).toBe(getSessionId())
  })

  it('세션 저장소가 비워지면 새 ID를 발급한다', () => {
    const first = getSessionId()
    sessionStorage.clear()

    expect(getSessionId()).not.toBe(first)
  })
})
