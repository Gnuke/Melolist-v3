export type SearchType = 'fingerprint' | 'humming'

export interface Artist {
  name?: string
}

export interface Album {
  name?: string
}

/** ACRCloud 인식 결과 (v2 SearchResultsList의 AcrResult와 동일 형태). */
export interface AcrResult {
  acrid?: string
  title?: string
  artists?: Artist[]
  album?: Album
  release_date?: string
  score?: number // 0~1
  youtube_url?: string
  [key: string]: unknown
}
