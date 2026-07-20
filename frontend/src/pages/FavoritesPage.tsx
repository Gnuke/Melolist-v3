import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ExternalLink, Heart, ListPlus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/authStore'
import { CoverArt } from '@/features/search/CoverArt'
import { getFavorites, removeFavorite, type FavoriteResponse, type FavoritesPage as Page } from '@/features/favorites/api'
import { AddToPlaylistSheet } from '@/features/playlists/AddToPlaylistSheet'
import { ProfileCorner } from '@/features/user/ProfileCorner'

const PAGE_SIZE = 20

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

/** 즐겨찾기 목록(M3) — 저장 최신순, 해제는 즉시 반영. 진입점: 홈 프로필 시트. */
export function FavoritesPage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const queryClient = useQueryClient()
  const [addTarget, setAddTarget] = useState<number | null>(null)

  const query = useInfiniteQuery({
    queryKey: ['favorites'],
    queryFn: ({ pageParam }) => getFavorites(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.total_pages ? last.page + 1 : undefined),
    enabled: !!session,
  })

  const removal = useMutation({
    mutationFn: (musicId: number) => removeFavorite(musicId),
    onSuccess: (_data, musicId) => {
      // 서버 재조회 없이 캐시에서 제거 — 목록이 짧아 페이지 재정렬은 다음 조회에 맡긴다
      queryClient.setQueryData<{ pages: Page[]; pageParams: number[] }>(['favorites'], (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.filter((f) => f.music.id !== musicId),
            total_items: Math.max(0, p.total_items - 1),
          })),
        },
      )
      toast('즐겨찾기에서 뺐어요')
    },
    onError: () => toast('해제하지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  // 세션 하이드레이션 전에는 판단 보류(스켈레톤) — 새로고침 직후 오판 방지
  if (initialized && !session) {
    return <Navigate to="/login" state={{ next: '/favorites' }} replace />
  }

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const totalItems = query.data?.pages[0]?.total_items ?? 0
  const loading = !initialized || query.isPending

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-4">
      <header className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="-ml-2 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft /> 홈
        </Button>
        <ProfileCorner />
      </header>

      <div className="pt-4">
        <h1 className="text-[26px] font-black leading-tight tracking-[-0.02em]">즐겨찾기</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? '불러오는 중…' : totalItems > 0 ? `저장한 곡 ${totalItems}곡` : '찾은 곡을 모아두는 곳이에요'}
        </p>
      </div>

      {loading ? (
        <div className="mt-5 flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-white/7 bg-card/60 p-3.5">
              <Skeleton className="size-14 shrink-0 rounded-[10px]" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">목록을 불러오지 못했어요</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
            className="rounded-full px-6 font-semibold"
          >
            다시 시도
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-brand/12 text-brand">
            <Heart className="size-6" />
          </span>
          <div>
            <p className="text-[17px] font-extrabold tracking-tight">아직 저장한 곡이 없어요</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              검색 결과에서 ♡를 누르면
              <br />
              여기에 모여요
            </p>
          </div>
          <Button asChild size="lg" className="h-12 rounded-full px-7 text-sm font-bold transition-transform active:scale-[0.97]">
            <Link to="/">
              <Search /> 노래 찾으러 가기
            </Link>
          </Button>
        </div>
      ) : (
        <>
          <motion.ul variants={listVariants} initial="hidden" animate="show" className="mt-5 flex flex-col gap-2.5">
            {items.map((f) => (
              <FavoriteRow
                key={f.id ?? f.music.id}
                f={f}
                removing={removal.isPending && removal.variables === f.music.id}
                onRemove={() => removal.mutate(f.music.id)}
                onAddToPlaylist={() => setAddTarget(f.music.id)}
              />
            ))}
          </motion.ul>

          {query.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={query.isFetchingNextPage}
                onClick={() => query.fetchNextPage()}
                className="h-11 rounded-full px-8 text-sm font-semibold"
              >
                {query.isFetchingNextPage ? '불러오는 중…' : '더 보기'}
              </Button>
            </div>
          )}
        </>
      )}

      <AddToPlaylistSheet musicId={addTarget} onClose={() => setAddTarget(null)} />
    </div>
  )
}

function FavoriteRow({
  f,
  removing,
  onRemove,
  onAddToPlaylist,
}: {
  f: FavoriteResponse
  removing: boolean
  onRemove: () => void
  onAddToPlaylist: () => void
}) {
  const m = f.music
  return (
    <motion.li
      variants={itemVariants}
      layout
      className="flex items-center gap-3.5 rounded-2xl border border-white/7 bg-card/60 p-3.5"
    >
      <CoverArt coverUrl={m.cover_url} videoId={m.youtube_video_id ?? undefined} alt={m.title ?? ''} className="size-14" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">{m.title ?? '-'}</p>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{m.artist ?? '미상'}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onAddToPlaylist}
          className="rounded-full text-muted-foreground hover:text-foreground"
          aria-label="플레이리스트에 담기"
        >
          <ListPlus />
        </Button>
        {m.youtube_url && (
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <a href={m.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube에서 듣기">
              <ExternalLink />
            </a>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={removing}
          onClick={onRemove}
          className="rounded-full text-brand transition-transform hover:text-brand active:scale-90"
          aria-label="즐겨찾기 해제"
        >
          <Heart className="fill-current" />
        </Button>
      </div>
    </motion.li>
  )
}
