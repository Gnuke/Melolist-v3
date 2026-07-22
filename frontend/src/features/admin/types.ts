/**
 * 어드민 API 계약 타입 — specs/003-admin-page-front/contracts/admin-api.md 와 1:1.
 * 계약이 정본이며, 필드 추가·변경은 계약 문서를 먼저 고친 뒤 여기에 반영한다.
 */

export type SearchMode = 'fingerprint' | 'humming'

/** KR2 행 — mode = null 이면 전체 롤업. */
export interface Kr2Row {
  mode: SearchMode | null
  n: number
  matched_n: number
  p50_ms: number
  p95_ms: number
  max_ms: number
  pass: boolean
}

/** KR2 구간 분해 — upsert_p95_ms 는 비동기 측정치(응답 경로 밖). */
export interface Kr2Breakdown {
  mode: SearchMode | null
  n: number
  acr_p95_ms: number
  meta_p95_ms: number
  upsert_p95_ms: number
  total_p95_ms: number
}

/** KR3 — completion_pct = null 이면 분모 0(방문 없음), 오류 아님. */
export interface Kr3 {
  target_pct: number
  visit_sessions: number
  completed_sessions: number
  completion_pct: number | null
  pass: boolean
}

export interface FailureRow {
  mode: string | null
  reason: string
  n: number
}

export interface WeeklyRow {
  week: string
  mode: SearchMode | null
  n: number
  p95_ms: number
}

export interface Totals {
  search_count: number
  matched_count: number
  user_count: number
  music_count: number
}

/** GET /api/admin/metrics 응답 전체. */
export interface AdminMetrics {
  period_days: number
  kr2: { target_ms: number; rows: Kr2Row[] }
  kr2_breakdown: Kr2Breakdown[]
  kr3: Kr3
  failures: FailureRow[]
  weekly: WeeklyRow[]
  totals: Totals
}

/** 곡 카탈로그 항목 (계약 §2). */
export interface MusicAdminItem {
  id: number
  acrid: string | null
  title: string
  artist: string | null
  album: string | null
  release_date: string | null
  youtube_video_id: string | null
  cover_url: string | null
  duration_ms: number | null
  source: string
  created_at: string
  updated_at: string
}

/** PATCH /api/admin/music/{id} 요청 — 담긴 필드만 수정, 빈 값은 null 정규화(계약 §3). */
export interface MusicAdminPatch {
  title?: string
  artist?: string | null
  album?: string | null
  release_date?: string | null
  youtube_video_id?: string | null
  cover_url?: string | null
}

export type AdminRole = 'USER' | 'ADMIN'

/** 사용자 목록 항목 (계약 §4). */
export interface UserAdminItem {
  id: string
  email: string
  display_name: string | null
  avatar_url: string | null
  role: AdminRole
  created_at: string
}

/** 목록 공통 페이지 응답 (기존 M3 목록 계약과 동일, snake_case). */
export interface PageResponse<T> {
  items: T[]
  page: number
  size: number
  total_items: number
  total_pages: number
}

export type MusicMissingFilter = 'video' | 'cover'

export interface MusicListParams {
  query?: string
  missing?: MusicMissingFilter
  page?: number
  size?: number
}

export interface UserListParams {
  page?: number
  size?: number
}

/** 가드 판정에 필요한 최소 신원 — GET /users/me 의 id·role 만 사용. */
export interface AdminIdentity {
  id: string
  role: string
}
