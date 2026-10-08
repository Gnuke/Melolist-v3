import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Compass, ListMusic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { track } from '@/features/events/track'
import { getCommunityPlaylists, type CommunityPlaylistItem } from '@/features/community/api'
import { ReviewsFeed } from '@/features/community/ReviewsFeed'
import { ProfileAvatar } from '@/features/user/ProfileAvatar'
import { ProfileCorner } from '@/features/user/ProfileCorner'
import { ThemeToggle } from '@/components/ThemeToggle'

const PAGE_SIZE = 20

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

type Segment = 'playlists' | 'reviews'

/**
 * 커뮤니티 탐색(M4, spec 005) — 게스트 포함 누구나 조회. 상단 세그먼트로
 * 공개 플레이리스트 피드 / 서비스 리뷰 피드를 전환한다(각각 독립 페이징).
 * 세그먼트는 ?segment= 쿼리로 복원 가능 — 로그인 복귀(state.next) 시 리뷰 탭 유지용.
 */
export function CommunityPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const segment: Segment = searchParams.get('segment') === 'reviews' ? 'reviews' : 'playlists'

  useEffect(() => {
    track('community_view', { segment })
  }, [segment])

  const setSegment = (next: Segment) => {
    setSearchParams(next === 'playlists' ? {} : { segment: next }, { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-4">
      <header className="mb-2 flex h-8 items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="-ml-2 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft /> 홈
        </Button>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <ProfileCorner />
        </div>
      </header>

      <div className="pt-4">
        <h1 className="text-[26px] font-black leading-tight tracking-[-0.02em]">커뮤니티</h1>
        <p className="mt-1 text-sm text-muted-foreground">다른 사람들의 발견을 구경해보세요</p>
      </div>

      <div className="mt-4 flex rounded-full bg-secondary/80 p-1" role="tablist" aria-label="피드 선택">
        {(
          [
            { key: 'playlists', label: '플레이리스트' },
            { key: 'reviews', label: '리뷰' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={segment === key}
            onClick={() => setSegment(key)}
            className={cn(
              'flex-1 rounded-full py-2 text-sm font-bold transition-colors',
              segment === key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {segment === 'playlists' ? <PlaylistsFeed /> : <ReviewsFeed />}
    </div>
  )
}

/** 공개 플레이리스트 피드(US1) — 수정 최신순, "더 보기" 페이징(기존 목록 관례). */
function PlaylistsFeed() {
  const query = useInfiniteQuery({
    queryKey: ['community-playlists'],
    queryFn: ({ pageParam }) => getCommunityPlaylists(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.total_pages ? last.page + 1 : undefined),
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []

  if (query.isPending) {
    return (
      <div className="mt-5 flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-border bg-card/60 p-3.5">
            <Skeleton className="size-14 shrink-0 rounded-[10px]" />
            <div className="flex w-full flex-col gap-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <p className="text-sm text-muted-foreground">피드를 불러오지 못했어요</p>
        <Button
          type="button"
          variant="outline"
          onClick={() => query.refetch()}
          className="rounded-full px-6 font-semibold"
        >
          다시 시도
        </Button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-iris/15 text-iris-soft">
          <Compass className="size-6" />
        </span>
        <div>
          <p className="text-[17px] font-extrabold tracking-tight">아직 공개된 플레이리스트가 없어요</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            플레이리스트를 공개로 바꾸면
            <br />
            여기에서 모두가 볼 수 있어요
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <motion.ul variants={listVariants} initial="hidden" animate="show" className="mt-5 flex flex-col gap-2.5">
        {items.map((p) => (
          <CommunityPlaylistRow key={p.id} p={p} />
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
  )
}

function CommunityPlaylistRow({ p }: { p: CommunityPlaylistItem }) {
  const authorName = p.author?.display_name ?? '알 수 없음'
  return (
    <motion.li variants={itemVariants} layout>
      <Link
        to={`/playlists/${p.id}`}
        className="flex items-center gap-3.5 rounded-2xl border border-border bg-card/60 p-3.5 transition-colors hover:bg-card"
      >
        {p.cover_url ? (
          <span className="relative size-14 shrink-0 overflow-hidden rounded-[10px] bg-secondary">
            <img src={p.cover_url} alt="" loading="lazy" className="size-full object-cover" />
            <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-foreground/10" />
          </span>
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[10px] bg-secondary text-muted-foreground/60">
            <ListMusic className="size-5" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{p.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <span className="shrink-0">{p.track_count}곡</span>
            <span aria-hidden>·</span>
            <span className="inline-flex min-w-0 items-center gap-1">
              <ProfileAvatar avatarUrl={p.author?.avatar_url} label={authorName} className="size-4 text-[9px]" />
              <span className="truncate">{authorName}</span>
            </span>
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      </Link>
    </motion.li>
  )
}
