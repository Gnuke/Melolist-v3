import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { cacheMe, useMe, type Profile } from './useMe'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'

// 실제 백엔드 왕복 없이 캐시(placeholder) 동작만 검증한다 — api가 유일한 목 경계.
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
}))

const mockedGet = vi.mocked(api.get)

const CACHE_KEY = 'melolist.me'

const me: Profile = {
  id: 'user-1',
  email: 'me@example.com',
  displayName: '멜로',
  avatarUrl: null,
  role: 'USER',
}

function renderUseMe(enabled = true) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return renderHook(() => useMe(enabled), { wrapper })
}

function loginAs(userId: string) {
  useAuthStore.setState({ user: { id: userId } as User })
}

describe('useMe 프로필 로컬 사본', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ session: null, user: null, initialized: false })
    mockedGet.mockReset()
    // 기본: 응답이 오지 않는 pending 상태 — placeholder 동작만 보이게 한다
    mockedGet.mockReturnValue(new Promise(() => {}))
  })

  it('cacheMe는 프로필을 localStorage에 저장한다', () => {
    cacheMe(me)

    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual(me)
  })

  it('같은 계정으로 로그인돼 있으면 서버 응답 전에도 사본을 placeholder로 보여준다', () => {
    cacheMe(me)
    loginAs('user-1')

    const { result } = renderUseMe()

    expect(result.current.data).toEqual(me)
  })

  it('다른 계정으로 로그인하면 이전 계정의 사본을 보여주지 않는다', () => {
    cacheMe(me)
    loginAs('user-2')

    const { result } = renderUseMe()

    expect(result.current.data).toBeUndefined()
  })

  it('비로그인 상태에서는 사본을 보여주지 않는다', () => {
    cacheMe(me)

    const { result } = renderUseMe(false)

    expect(result.current.data).toBeUndefined()
  })

  it('사본이 깨져 있어도 예외 없이 undefined로 처리한다', () => {
    localStorage.setItem(CACHE_KEY, '{not-json')
    loginAs('user-1')

    const { result } = renderUseMe()

    expect(result.current.data).toBeUndefined()
  })

  it('서버 조회가 성공하면 응답으로 사본을 갱신한다', async () => {
    cacheMe(me)
    loginAs('user-1')
    const updated: Profile = { ...me, displayName: '새 별명' }
    mockedGet.mockResolvedValue({ data: updated })

    const { result } = renderUseMe()

    await waitFor(() => expect(result.current.data).toEqual(updated))
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual(updated)
  })
})
