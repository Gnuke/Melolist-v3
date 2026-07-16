import { api } from '@/lib/api'
import type { FavoriteMusic } from '@/features/favorites/api'

export type SearchHistoryType = 'fingerprint' | 'humming' | 'text'

/** GET /api/search/history 항목(M3 계약, snake_case) — no_match면 music null. */
export interface SearchHistoryItem {
  id: number
  type: SearchHistoryType
  status: 'matched' | 'no_match'
  score: number | null
  music: FavoriteMusic | null
  created_at: string
}

export interface HistoryPageData {
  items: SearchHistoryItem[]
  page: number
  size: number
  total_items: number
  total_pages: number
}

/** 내 검색 기록 — 최신순(로그인 필수). */
export async function getHistory(page: number, size = 20): Promise<HistoryPageData> {
  const { data } = await api.get<HistoryPageData>('/search/history', { params: { page, size } })
  return data
}

/** 기록 1건 삭제(본인 것만 — 비소유는 404). */
export async function removeHistory(id: number): Promise<void> {
  await api.delete(`/search/history/${id}`)
}
