import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AdminDashboardPage } from './AdminDashboardPage'
import { fetchAdminMetrics } from '@/features/admin/api'
import type { AdminMetrics } from '@/features/admin/types'

// api가 유일한 목 경계 — 응답 형태만으로 렌더 안정성 검증
vi.mock('@/features/admin/api', () => ({
  fetchAdminMetrics: vi.fn(),
  isAdminAuthError: () => false,
}))

const mockedFetch = vi.mocked(fetchAdminMetrics)

/** 기간 내 검색 0건 — rollup이 전체 행(n=0, *_ms=null)을 돌려주는 운영 실응답 형태. */
const emptyPeriod: AdminMetrics = {
  period_days: 14,
  kr2: {
    target_ms: 10000,
    rows: [{ mode: null, n: 0, matched_n: 0, p50_ms: null, p95_ms: null, max_ms: null, pass: false }],
  },
  kr2_breakdown: [
    { mode: null, n: 0, acr_p95_ms: null, meta_p95_ms: null, upsert_p95_ms: null, total_p95_ms: null },
  ],
  kr3: { target_pct: 60, visit_sessions: 0, completed_sessions: 0, completion_pct: null, pass: false },
  failures: [],
  weekly: [],
  totals: { search_count: 0, matched_count: 0, user_count: 3, music_count: 146 },
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return render(<AdminDashboardPage />, { wrapper })
}

describe('AdminDashboardPage', () => {
  afterEach(cleanup)

  it('기간 내 검색 0건(rollup n=0 행)이어도 크래시 없이 빈 상태를 표시한다', async () => {
    mockedFetch.mockResolvedValue(emptyPeriod)
    renderPage()

    expect(await screen.findByText('기간 내 검색 없음')).toBeTruthy()
    // KR2 모드별·구간 분해·주간 추이 모두 빈 상태
    expect(screen.getAllByText('이 기간에는 데이터가 없어요').length).toBe(3)
  })

  it('표본이 있는 모드의 일부 구간 값이 null이면 — 로 표시한다', async () => {
    mockedFetch.mockResolvedValue({
      ...emptyPeriod,
      kr2_breakdown: [
        { mode: 'fingerprint', n: 2, acr_p95_ms: 900, meta_p95_ms: null, upsert_p95_ms: null, total_p95_ms: 1200 },
      ],
    })
    renderPage()

    expect(await screen.findByText('900ms')).toBeTruthy()
    expect(screen.getAllByText('—').length).toBe(2)
  })
})
