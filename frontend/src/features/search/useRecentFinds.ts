import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { getHistory } from '@/features/history/api'
import { getRecentFinds, type RecentFind } from './recentFinds'

const SHELF_SIZE = 3
/** 같은 곡 반복 검색이 흔해서 곡 중복 제거 후에도 3곡이 차도록 넉넉히 조회 */
const FETCH_SIZE = 12

/**
 * 홈 "최근 찾은 곡" 원천 — 로그인=서버 검색 기록(기기 간 일관, 기록 삭제와 동기),
 * 게스트=localStorage(게스트 검색은 서버 기록에 남지 않아 로컬이 유일한 원천).
 * 세션 하이드레이션 전에는 빈 목록 — 로컬→서버로 셸프가 바뀌는 깜빡임 방지.
 */
export function useRecentFinds(): RecentFind[] {
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)

  const serverQuery = useQuery({
    queryKey: ['search-history', 'recent-shelf'],
    queryFn: () => getHistory(0, FETCH_SIZE),
    enabled: !!session,
  })

  const serverItems = serverQuery.data?.items

  return useMemo(() => {
    if (!session) return initialized ? getRecentFinds().slice(0, SHELF_SIZE) : []
    const seen = new Set<number>()
    const finds: RecentFind[] = []
    for (const h of serverItems ?? []) {
      if (h.status !== 'matched' || !h.music || seen.has(h.music.id)) continue
      seen.add(h.music.id)
      finds.push({
        key: String(h.music.id),
        title: h.music.title ?? '-',
        artist: h.music.artist ?? '미상',
        coverUrl: h.music.cover_url,
        videoId: h.music.youtube_video_id ?? undefined,
        youtubeUrl: h.music.youtube_url ?? undefined,
        at: new Date(h.created_at).getTime(),
      })
      if (finds.length >= SHELF_SIZE) break
    }
    return finds
  }, [session, initialized, serverItems])
}
