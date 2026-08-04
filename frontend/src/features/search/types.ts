export type SearchType = 'fingerprint' | 'humming'

export interface Artist {
  name?: string
}

export interface Album {
  name?: string
}

/**
 * 인식/폴백 검색 결과 (backend-prd §6.1 M2 계약 + spec 002 AI 폴백 호환).
 * AI 폴백 후보는 acrid에 `ai-` 키가 들어가고 score·release_date는 null이다.
 */
export interface AcrResult {
  acrid?: string
  title?: string
  artists?: Artist[]
  album?: Album | null
  release_date?: string | null
  score?: number | null // 0~1, 허밍만 노출 — AI 폴백 후보는 null(배지 미표시)
  youtube_url?: string // 듣기 버튼용 (watch?v= 파생값)
  youtube_video_id?: string // onError 썸네일 폴백용
  cover_url?: string | null // 카드 이미지 (null 가능 → 플레이스홀더)
  // 심층 탐색(spec 004) 전용 — false일 때만 "미확인" 배지 표시. 기존 검색 응답에는 키 자체가 없다
  verified?: boolean
  [key: string]: unknown
}
