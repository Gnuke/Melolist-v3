import { isAxiosError } from 'axios'
import { api } from '@/lib/api'

/** POST /api/favorites 응답 — 곡 스냅샷 포함(M3 계약, snake_case). */
export interface FavoriteResponse {
  id: number | null
  music: {
    id: number
    title?: string | null
    artist?: string | null
    youtube_url?: string | null
    cover_url?: string | null
  }
  created_at: string | null
}

/**
 * MUSIC upsert는 검색 응답 뒤 비동기로 돌므로(§5.3), 결과 직후 ♡를 누르면
 * 행이 아직 없어 404가 날 수 있다 — 한 번 기다렸다 재시도한다(실측 upsert p95 ~2.5s).
 */
const UPSERT_RETRY_DELAY_MS = 1500

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 검색 결과를 즐겨찾기에 담는다(멱등 — 이미 있으면 기존 행 반환). */
export async function addFavorite(acrid: string): Promise<FavoriteResponse> {
  try {
    return (await api.post<FavoriteResponse>('/favorites', { acrid })).data
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) {
      await delay(UPSERT_RETRY_DELAY_MS)
      return (await api.post<FavoriteResponse>('/favorites', { acrid })).data
    }
    throw err
  }
}

/** 즐겨찾기 해제(멱등 — 없어도 조용히 성공). */
export async function removeFavorite(musicId: number): Promise<void> {
  await api.delete(`/favorites/${musicId}`)
}
