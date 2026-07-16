import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ExternalLink, History, Search, SearchX, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/authStore'
import { CoverArt } from '@/features/search/CoverArt'
import {
  getHistory,
  removeHistory,
  type HistoryPageData,
  type SearchHistoryItem,
  type SearchHistoryType,
} from '@/features/history/api'

const PAGE_SIZE = 20

const MODE_LABEL: Record<SearchHistoryType, string> = {
  fingerprint: '노래 찾기',
  humming: '허밍',
  text: '텍스트',
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

/** 검색 기록(M3, C4) — 최신순, 본인 것만. 진입점: 홈 프로필 시트. */
export function HistoryPage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const queryClient = useQueryClient()

  const query = useInfiniteQuery({
    queryKey: ['search-history'],
    queryFn: ({ pageParam }) => getHistory(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.total_pages ? last.page + 1 : undefined),
    enabled: !!session,
  })

  const removal = useMutation({
    mutationFn: (id: number) => removeHistory(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<{ pages: HistoryPageData[]; pageParams: number[] }>(['search-history'], (data) =>
        data && {
          ...data,
          pages: data.pages.map((p) => ({
            ...p,
            items: p.items.filter((h) => h.id !== id),
            total_items: Math.max(0, p.total_items - 1),
          })),
        },
      )
      toast('기록을 지웠어요')
    },
    onError: () => toast('지우지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  // 세션 하이드레이션 전에는 판단 보류(스켈레톤) — 새로고침 직후 오판 방지
  if (initialized && !session) {
    return <Navigate to="/login" state={{ next: '/history' }} replace />
  }

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const totalItems = query.data?.pages[0]?.total_items ?? 0
  const loading = !initialized || query.isPending

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-4">
      <header className="mb-2 flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="-ml-2 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft /> 홈
        </Button>
      </header>

      <div className="pt-4">
        <h1 className="text-[26px] font-black leading-tight tracking-[-0.02em]">검색 기록</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? '불러오는 중…' : totalItems > 0 ? `기록 ${totalItems}건` : '로그인 상태로 검색하면 기록이 남아요'}
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
          <p className="text-sm text-muted-foreground">기록을 불러오지 못했어요</p>
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
          <span className="flex size-14 items-center justify-center rounded-full bg-iris/15 text-iris-soft">
            <History className="size-6" />
          </span>
          <div>
            <p className="text-[17px] font-extrabold tracking-tight">아직 검색 기록이 없어요</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              로그인 상태로 곡을 찾으면
              <br />
              여기에 차곡차곡 쌓여요
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
            {items.map((h) => (
              <HistoryRow
                key={h.id}
                h={h}
                removing={removal.isPending && removal.variables === h.id}
                onRemove={() => removal.mutate(h.id)}
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
    </div>
  )
}

function HistoryRow({ h, removing, onRemove }: { h: SearchHistoryItem; removing: boolean; onRemove: () => void }) {
  const matched = h.status === 'matched' && h.music
  const metaLine = `${MODE_LABEL[h.type] ?? h.type} · ${formatWhen(h.created_at)}`

  return (
    <motion.li
      variants={itemVariants}
      layout
      className="flex items-center gap-3.5 rounded-2xl border border-white/7 bg-card/60 p-3.5"
    >
      {matched ? (
        <CoverArt
          coverUrl={h.music!.cover_url}
          videoId={h.music!.youtube_video_id ?? undefined}
          alt={h.music!.title ?? ''}
          className="size-14"
        />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground/60">
          <SearchX className="size-5" />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {matched ? (
          <>
            <p className="truncate text-[15px] font-bold">{h.music!.title ?? '-'}</p>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{h.music!.artist ?? '미상'}</p>
          </>
        ) : (
          <p className="truncate text-[15px] font-semibold text-muted-foreground">일치하는 곡을 찾지 못했어요</p>
        )}
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground/80">
          {metaLine}
          {matched && h.type === 'humming' && typeof h.score === 'number' && (
            <span className="rounded-full bg-iris/15 px-1.5 py-px font-bold text-iris-soft">
              {Math.round(h.score * 100)}%
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1">
        {matched && h.music!.youtube_url && (
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-muted-foreground hover:text-foreground"
          >
            <a href={h.music!.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube에서 듣기">
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
          className="rounded-full text-muted-foreground transition-transform hover:text-destructive active:scale-90"
          aria-label="기록 삭제"
        >
          <Trash2 />
        </Button>
      </div>
    </motion.li>
  )
}
