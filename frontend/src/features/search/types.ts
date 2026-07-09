export type SearchType = 'fingerprint' | 'humming'

export interface Artist {
  name?: string
}

export interface Album {
  name?: string
}

/** ACRCloud 인식 결과 (backend-prd §6.1 M2 계약). */
export interface AcrResult {
  acrid?: string
  title?: string
  artists?: Artist[]
  album?: Album
  release_date?: string
  score?: number // 0~1, 허밍만 노출
  youtube_url?: string // 듣기 버튼용 (watch?v= 파생값)
  youtube_video_id?: string // onError 썸네일 폴백용
  cover_url?: string | null // 카드 이미지 (null 가능 → 플레이스홀더)
  [key: string]: unknown
}
