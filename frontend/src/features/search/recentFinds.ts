import type { AcrResult } from './types'

export interface RecentFind {
  key: string
  title: string
  artist: string
  coverUrl?: string | null
  videoId?: string
  youtubeUrl?: string
  at: number
}

const KEY = 'melolist.recent-finds'
const MAX = 6

/** 홈 "최근 찾은 곡" 선반용 로컬 기록 (클라 전용 — 서버 SearchHistory는 M3). */
export function getRecentFinds(): RecentFind[] {
  try {
    const raw = localStorage.getItem(KEY)
    const list = raw ? (JSON.parse(raw) as RecentFind[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

/** 검색 성공 시 Top-1을 기록한다 (저신뢰 F3 결과는 기록하지 않음). */
export function addRecentFind(r: AcrResult): void {
  const title = r.title?.trim()
  if (!title) return
  const find: RecentFind = {
    key: r.acrid ?? `${title}-${r.artists?.[0]?.name ?? ''}`,
    title,
    artist: r.artists?.[0]?.name?.trim() || '미상',
    coverUrl: r.cover_url,
    videoId: r.youtube_video_id,
    youtubeUrl: r.youtube_url,
    at: Date.now(),
  }
  try {
    const rest = getRecentFinds().filter((f) => f.key !== find.key)
    localStorage.setItem(KEY, JSON.stringify([find, ...rest].slice(0, MAX)))
  } catch {
    // 저장 실패는 무시 (프라이빗 모드 등)
  }
}
