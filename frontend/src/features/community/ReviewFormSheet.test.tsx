import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ReviewFormSheet } from './ReviewFormSheet'
import { createReview, getMyReview, type Review } from '@/features/community/api'

// 실제 백엔드 왕복 없이 폼 게이팅·409 전환만 검증 — api가 유일한 목 경계(useMe.test 관례).
vi.mock('@/features/community/api', () => ({
  createReview: vi.fn(),
  updateReview: vi.fn(),
  getMyReview: vi.fn(),
}))
vi.mock('@/features/events/track', () => ({ track: vi.fn() }))

const mockedCreate = vi.mocked(createReview)
const mockedGetMine = vi.mocked(getMyReview)

const existing: Review = {
  id: 7,
  rating: 4,
  content: '기존에 남긴 리뷰',
  author: { id: 'user-1', display_name: '멜로', avatar_url: null },
}

function renderSheet() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  return render(<ReviewFormSheet open onClose={() => undefined} initial={null} />, { wrapper })
}

const textarea = () => screen.getByPlaceholderText(/들려주세요/) as HTMLTextAreaElement
const submitButton = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

describe('ReviewFormSheet', () => {
  beforeEach(() => {
    mockedCreate.mockReset()
    mockedGetMine.mockReset()
  })

  // vitest globals 미사용 구성이라 testing-library 자동 cleanup이 없다 — DOM 누적 방지
  afterEach(() => cleanup())

  it('별점을 고르기 전에는 제출할 수 없다', () => {
    renderSheet()

    fireEvent.change(textarea(), { target: { value: '내용은 있음' } })
    fireEvent.submit(textarea().closest('form')!)

    expect(submitButton('리뷰 남기기').disabled).toBe(true)
    expect(mockedCreate).not.toHaveBeenCalled()
  })

  it('내용 입력창은 500자 상한을 강제한다', () => {
    renderSheet()

    expect(textarea().getAttribute('maxlength')).toBe('500')
  })

  it('409(이미 작성)를 만나면 기존 리뷰를 불러와 수정 모드로 전환한다', async () => {
    mockedCreate.mockRejectedValue(
      Object.assign(new Error('conflict'), { isAxiosError: true, response: { status: 409 } }),
    )
    mockedGetMine.mockResolvedValue(existing)
    renderSheet()

    fireEvent.click(screen.getByRole('radio', { name: '별점 5점' }))
    fireEvent.change(textarea(), { target: { value: '새 리뷰 시도' } })
    fireEvent.click(submitButton('리뷰 남기기'))

    await waitFor(() => expect(mockedGetMine).toHaveBeenCalled())
    // 수정 모드 전환: 기존 내용이 폼에 실리고 제출 버튼 라벨이 바뀐다
    await waitFor(() => expect(screen.getByDisplayValue('기존에 남긴 리뷰')).toBeTruthy())
    expect(submitButton('수정하기')).toBeTruthy()
  })
})
