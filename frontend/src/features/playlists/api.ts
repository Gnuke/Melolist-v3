import { api } from '@/lib/api'
import type { FavoriteMusic } from '@/features/favorites/api'

/** GET /api/playlists 항목(PlaylistResponse, snake_case). */
export interface PlaylistSummary {
  id: number
  owner_id: string
  title: string
  description: string | null
  is_public: boolean
  cover_url: string | null
  track_count: number
  created_at: string
  updated_at: string
}

export interface PlaylistTrack {
  music: FavoriteMusic
  position: number
  added_at: string
}

/** GET /api/playlists/{id} — tracks는 position 오름차순. */
export interface PlaylistDetail {
  id: number
  owner_id: string
  title: string
  description: string | null
  is_public: boolean
  cover_url: string | null
  tracks: PlaylistTrack[]
  created_at: string
  updated_at: string
}

export interface PlaylistFormValues {
  title: string
  description: string
  is_public: boolean
}

/** 내 플레이리스트 — 수정 최신순(로그인 필수). */
export async function getPlaylists(): Promise<PlaylistSummary[]> {
  const { data } = await api.get<PlaylistSummary[]>('/playlists')
  return data
}

export async function createPlaylist(values: PlaylistFormValues): Promise<PlaylistSummary> {
  const { data } = await api.post<PlaylistSummary>('/playlists', {
    title: values.title,
    description: values.description || null,
    is_public: values.is_public,
  })
  return data
}

/** 상세 — 공개 플레이리스트는 게스트도 조회 가능, 비공개는 소유자 외 404. */
export async function getPlaylistDetail(id: number): Promise<PlaylistDetail> {
  const { data } = await api.get<PlaylistDetail>(`/playlists/${id}`)
  return data
}

export async function updatePlaylist(id: number, values: PlaylistFormValues): Promise<PlaylistSummary> {
  const { data } = await api.patch<PlaylistSummary>(`/playlists/${id}`, {
    title: values.title,
    description: values.description,
    is_public: values.is_public,
  })
  return data
}

export async function deletePlaylist(id: number): Promise<void> {
  await api.delete(`/playlists/${id}`)
}

/** 곡 담기 — 이미 담긴 곡이면 409. */
export async function addTrack(playlistId: number, musicId: number): Promise<void> {
  await api.post(`/playlists/${playlistId}/tracks`, { music_id: musicId })
}

export async function removeTrack(playlistId: number, musicId: number): Promise<void> {
  await api.delete(`/playlists/${playlistId}/tracks/${musicId}`)
}

/** 순서 변경 — 담긴 전체 music id를 새 순서대로 보낸다. */
export async function reorderTracks(playlistId: number, musicIds: number[]): Promise<void> {
  await api.patch(`/playlists/${playlistId}/tracks/reorder`, { music_ids: musicIds })
}
