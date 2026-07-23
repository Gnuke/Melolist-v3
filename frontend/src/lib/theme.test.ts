import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { getTheme, setTheme, useTheme } from './theme'

const STORAGE_KEY = 'melolist.theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
    document.head.innerHTML = '<meta name="theme-color" content="">'
  })

  it('dark 설정 시 html에 dark 클래스가 붙고 저장·메타 색상이 갱신된다', () => {
    setTheme('dark')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#0a0a0c')
  })

  it('light 설정 시 dark 클래스가 제거되고 저장·메타 색상이 갱신된다', () => {
    setTheme('dark')

    setTheme('light')

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#faf7f4')
  })

  it('getTheme은 html 클래스 상태를 그대로 반영한다', () => {
    expect(getTheme()).toBe('light')

    document.documentElement.classList.add('dark')

    expect(getTheme()).toBe('dark')
  })

  it('meta[name=theme-color]가 없어도 setTheme이 예외를 던지지 않는다', () => {
    document.head.innerHTML = ''

    expect(() => setTheme('dark')).not.toThrow()
    expect(getTheme()).toBe('dark')
  })

  it('useTheme은 setTheme 호출에 반응해 리렌더된다', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current).toBe('light')

    act(() => setTheme('dark'))

    expect(result.current).toBe('dark')

    act(() => setTheme('light'))

    expect(result.current).toBe('light')
  })
})
