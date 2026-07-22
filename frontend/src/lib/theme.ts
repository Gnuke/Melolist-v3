import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

/** index.html 인라인 스크립트와 같은 키/값 — 함께 바꿀 것 */
const STORAGE_KEY = 'melolist.theme'
const META_COLOR: Record<Theme, string> = { dark: '#0a0a0c', light: '#faf7f4' }

const listeners = new Set<() => void>()

export function getTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[theme])
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // 시크릿 모드 등 저장 불가 — 현재 세션 적용만 유지
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme)
}
