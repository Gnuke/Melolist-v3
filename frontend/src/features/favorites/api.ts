import { isAxiosError } from 'axios'
import { api } from '@/lib/api'

/** 곡 스냅샷(MusicResponse, snake_case). */
export interface FavoriteMusic {
  id: number
  title?: string | null
  artist?: string | null
  album?: string | null
  release_date?: string | null
  youtube_video_id?: string | null
  youtube_url?: string | null
  cover_url?: string | null
}

/** POST /api/favorites 응답 — 곡 스냅샷 포함(M3 계약, snake_case). */
export interface FavoriteResponse {
  id: number | null
  music: FavoriteMusic
  created_at: string | null
}

/** GET /api/favorites 페이지(PageResponse, snake_case). */
export interface FavoritesPage {
  items: FavoriteResponse[]
  page: number
  size: number
  total_items: number
  total_pages: number
}

/** 내 즐겨찾기 목록 — 저장 최신순. */
export async function getFavorites(page: number, size = 20): Promise<FavoritesPage> {
  const { data } = await api.get<FavoritesPage>('/favorites', { params: { page, size } })
  return data
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

/** MUSIC 행이 이미 있는 곡(기록 등 목록 화면)을 담는다 — acrid 재시도 불필요, 멱등. */
export async function addFavoriteByMusicId(musicId: number): Promise<FavoriteResponse> {
  const { data } = await api.post<FavoriteResponse>('/favorites', { music_id: musicId })
  return data
}

/** 즐겨찾기 해제(멱등 — 없어도 조용히 성공). */
export async function removeFavorite(musicId: number): Promise<void> {
  await api.delete(`/favorites/${musicId}`)
}
