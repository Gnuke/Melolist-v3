import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Globe, ListMusic, Lock, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/authStore'
import { createPlaylist, getPlaylists, type PlaylistSummary } from '@/features/playlists/api'
import { PlaylistFormSheet } from '@/features/playlists/PlaylistFormSheet'
import { ProfileCorner } from '@/features/user/ProfileCorner'

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

/** 플레이리스트 목록(M3) — 수정 최신순. 생성하면 곧장 상세로 이동해 곡 담기를 잇는다. */
export function PlaylistsPage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)

  const query = useQuery({
    queryKey: ['playlists'],
    queryFn: getPlaylists,
    enabled: !!session,
  })

  const creation = useMutation({
    mutationFn: createPlaylist,
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setCreating(false)
      navigate(`/playlists/${created.id}`)
    },
    onError: () => toast('만들지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  // 세션 하이드레이션 전에는 판단 보류(스켈레톤) — 새로고침 직후 오판 방지
  if (initialized && !session) {
    return <Navigate to="/login" state={{ next: '/playlists' }} replace />
  }

  const items = query.data ?? []
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

      <div className="flex items-end justify-between pt-4">
        <div>
          <h1 className="text-[26px] font-black leading-tight tracking-[-0.02em]">플레이리스트</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? '불러오는 중…' : items.length > 0 ? `${items.length}개` : '찾은 곡을 주제별로 모아보세요'}
          </p>
        </div>
        {!loading && items.length > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={() => setCreating(true)}
            className="rounded-full px-4 font-bold transition-transform active:scale-[0.97]"
          >
            <Plus /> 새로 만들기
          </Button>
        )}
      </div>

      {loading ? (
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
            <ListMusic className="size-6" />
          </span>
          <div>
            <p className="text-[17px] font-extrabold tracking-tight">아직 플레이리스트가 없어요</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              즐겨찾기한 곡을 주제별로
              <br />
              모아둘 수 있어요
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={() => setCreating(true)}
            className="h-12 rounded-full px-7 text-sm font-bold transition-transform active:scale-[0.97]"
          >
            <Plus /> 새 플레이리스트 만들기
          </Button>
        </div>
      ) : (
        <motion.ul variants={listVariants} initial="hidden" animate="show" className="mt-5 flex flex-col gap-2.5">
          {items.map((p) => (
            <PlaylistRow key={p.id} p={p} />
          ))}
        </motion.ul>
      )}

      <PlaylistFormSheet
        open={creating}
        onClose={() => setCreating(false)}
        initial={null}
        pending={creation.isPending}
        onSubmit={(values) => creation.mutate(values)}
      />
    </div>
  )
}

function PlaylistRow({ p }: { p: PlaylistSummary }) {
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
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-muted-foreground">
            {p.track_count}곡
            <span aria-hidden>·</span>
            {p.is_public ? (
              <span className="inline-flex items-center gap-0.5"><Globe className="size-3" /> 공개</span>
            ) : (
              <span className="inline-flex items-center gap-0.5"><Lock className="size-3" /> 비공개</span>
            )}
          </p>
        </div>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
      </Link>
    </motion.li>
  )
}
