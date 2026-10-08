import { isAxiosError } from 'axios'
import { api } from '@/lib/api'

/** 리뷰·댓글·피드 작성자 요약(AuthorSummary, snake_case — spec 005 계약 공통 타입). */
export interface AuthorSummary {
  id: string
  display_name?: string | null
  avatar_url?: string | null
}

/** PageResponse(snake_case) — community 도메인 공용 페이지 제네릭. */
export interface Page<T> {
  items: T[]
  page: number
  size: number
  total_items: number
  total_pages: number
}

/** GET /api/community/playlists 항목 — PlaylistResponse + 작성자 요약(spec 005 계약 §1). */
export interface CommunityPlaylistItem {
  id: number
  owner_id: string
  title: string
  description?: string | null
  is_public: boolean
  cover_url?: string | null
  track_count: number
  created_at?: string | null
  updated_at?: string | null
  author?: AuthorSummary | null
}

/** 공개 플레이리스트 피드 — 게스트 허용, 수정 최신순. */
export async function getCommunityPlaylists(page: number, size = 20): Promise<Page<CommunityPlaylistItem>> {
  const { data } = await api.get<Page<CommunityPlaylistItem>>('/community/playlists', { params: { page, size } })
  return data
}

/** 서비스 리뷰(앱 평가 — 1인 1건, spec 005 계약 §2). */
export interface Review {
  id: number
  author?: AuthorSummary | null
  rating: number
  content: string
  created_at?: string | null
  updated_at?: string | null
}

/** 리뷰 피드 — 게스트 허용, 작성 최신순. */
export async function getReviews(page: number, size = 20): Promise<Page<Review>> {
  const { data } = await api.get<Page<Review>>('/reviews', { params: { page, size } })
  return data
}

/** 내 리뷰 — 404(작성한 리뷰 없음)는 오류가 아니라 "작성 가능"이므로 null로 정규화. */
export async function getMyReview(): Promise<Review | null> {
  try {
    return (await api.get<Review>('/reviews/me')).data
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) return null
    throw err
  }
}

/** 리뷰 작성 — 이미 있으면 409(1인 1건, 호출부에서 수정 전환 처리). */
export async function createReview(rating: number, content: string): Promise<Review> {
  const { data } = await api.post<Review>('/reviews', { rating, content })
  return data
}

/** 리뷰 부분 수정 — 작성자 본인만. */
export async function updateReview(id: number, values: { rating?: number; content?: string }): Promise<Review> {
  const { data } = await api.patch<Review>(`/reviews/${id}`, values)
  return data
}

/** 리뷰 삭제 — 작성자 본인만, 삭제 후 재작성 가능. */
export async function deleteReview(id: number): Promise<void> {
  await api.delete(`/reviews/${id}`)
}

/** 공개 플레이리스트 댓글(spec 005 계약 §4) — parent_id는 v1 예약(보내지도 그리지도 않음). */
export interface PlaylistComment {
  id: number
  playlist_id: number
  parent_id?: number | null
  author?: AuthorSummary | null
  content: string
  created_at?: string | null
  updated_at?: string | null
}

/** 댓글 목록 — 공개 항목은 게스트도 조회 가능, 작성 오름차순(비페이지). */
export async function getComments(playlistId: number): Promise<PlaylistComment[]> {
  const { data } = await api.get<PlaylistComment[]>(`/playlists/${playlistId}/comments`)
  return data
}

/** 댓글 작성 — 로그인 전용. 대상이 비공개 전환·삭제됐으면 404. */
export async function createComment(playlistId: number, content: string): Promise<PlaylistComment> {
  const { data } = await api.post<PlaylistComment>(`/playlists/${playlistId}/comments`, { content })
  return data
}

/** 댓글 삭제 — 작성자 본인만. */
export async function deleteComment(id: number): Promise<void> {
  await api.delete(`/comments/${id}`)
}

/** 리뷰 유도 노출 자격(spec 005 계약 §2) — 서버 권위 판정, 로그인 전용. */
export async function getReviewPrompt(): Promise<{ eligible: boolean }> {
  const { data } = await api.get<{ eligible: boolean }>('/reviews/prompt')
  return data
}

/** 리뷰 유도 "나중에" — 서버 유예 저장(7일, 기기 무관). 204 무본문. */
export async function deferReviewPrompt(): Promise<void> {
  await api.patch('/users/me/review-visibility', { action: 'later' })
}
