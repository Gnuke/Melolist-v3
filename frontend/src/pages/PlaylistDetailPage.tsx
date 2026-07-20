import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ExternalLink,
  Globe,
  Heart,
  ListMusic,
  Lock,
  Pencil,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BottomSheet } from '@/components/BottomSheet'
import { useAuthStore } from '@/stores/authStore'
import { CoverArt } from '@/features/search/CoverArt'
import {
  deletePlaylist,
  getPlaylistDetail,
  removeTrack,
  reorderTracks,
  updatePlaylist,
  type PlaylistDetail,
  type PlaylistTrack,
} from '@/features/playlists/api'
import { PlaylistFormSheet } from '@/features/playlists/PlaylistFormSheet'

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

/**
 * 플레이리스트 상세(M3) — 공개면 게스트도 조회 가능, 편집(정보 수정·삭제·곡
 * 빼기·순서)은 소유자만. 비공개 비소유 접근은 백엔드가 404로 감춘다.
 */
export function PlaylistDetailPage() {
  const { id } = useParams()
  const playlistId = Number(id)
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [reordering, setReordering] = useState(false)

  const query = useQuery({
    queryKey: ['playlist', playlistId],
    queryFn: () => getPlaylistDetail(playlistId),
    enabled: Number.isFinite(playlistId),
    retry: (count, err) => !(isAxiosError(err) && err.response?.status === 404) && count < 2,
  })

  const setDetail = (updater: (prev: PlaylistDetail) => PlaylistDetail) =>
    queryClient.setQueryData<PlaylistDetail>(['playlist', playlistId], (prev) => prev && updater(prev))

  const update = useMutation({
    mutationFn: (values: { title: string; description: string; is_public: boolean }) =>
      updatePlaylist(playlistId, values),
    onSuccess: (updated) => {
      setDetail((prev) => ({
        ...prev,
        title: updated.title,
        description: updated.description,
        is_public: updated.is_public,
        updated_at: updated.updated_at,
      }))
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      setEditing(false)
      toast('수정했어요')
    },
    onError: () => toast('수정하지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  const removal = useMutation({
    mutationFn: () => deletePlaylist(playlistId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['playlist', playlistId] })
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      toast('플레이리스트를 삭제했어요')
      navigate('/playlists', { replace: true })
    },
    onError: () => toast('삭제하지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  const trackRemoval = useMutation({
    mutationFn: (musicId: number) => removeTrack(playlistId, musicId),
    onSuccess: (_data, musicId) => {
      setDetail((prev) => ({ ...prev, tracks: prev.tracks.filter((t) => t.music.id !== musicId) }))
      queryClient.invalidateQueries({ queryKey: ['playlists'] })
      toast('플레이리스트에서 뺐어요')
    },
    onError: () => toast('빼지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  const reorder = useMutation({
    mutationFn: (musicIds: number[]) => reorderTracks(playlistId, musicIds),
    onError: () => {
      // 낙관 반영을 되돌린다 — 서버 순서로 재조회
      queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] })
      toast('순서를 저장하지 못했어요')
    },
  })

  const moveTrack = (index: number, delta: -1 | 1) => {
    const tracks = query.data?.tracks
    if (!tracks) return
    const target = index + delta
    if (target < 0 || target >= tracks.length) return
    const next = [...tracks]
    ;[next[index], next[target]] = [next[target], next[index]]
    setDetail((prev) => ({ ...prev, tracks: next }))
    reorder.mutate(next.map((t) => t.music.id))
  }

  const detail = query.data
  const isOwner = !!detail && !!user && user.id === detail.owner_id
  const notFound = query.isError && isAxiosError(query.error) && query.error.response?.status === 404

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-4">
      <header className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate(session ? '/playlists' : '/')}
          className="-ml-2 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft /> {session ? '플레이리스트' : '홈'}
        </Button>
        {isOwner && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(true)}
              className="rounded-full text-muted-foreground hover:text-foreground"
              aria-label="플레이리스트 수정"
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setConfirmingDelete(true)}
              className="rounded-full text-muted-foreground hover:text-destructive"
              aria-label="플레이리스트 삭제"
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </header>

      {query.isPending ? (
        <div className="pt-4">
          <Skeleton className="h-7 w-3/5" />
          <Skeleton className="mt-2.5 h-4 w-2/5" />
          <div className="mt-6 flex flex-col gap-2.5">
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
        </div>
      ) : notFound || !Number.isFinite(playlistId) ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-16 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-muted-foreground/60">
            <ListMusic className="size-6" />
          </span>
          <div>
            <p className="text-[17px] font-extrabold tracking-tight">플레이리스트를 찾을 수 없어요</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">삭제됐거나 비공개로 바뀌었을 수 있어요</p>
          </div>
          <Button asChild variant="outline" className="rounded-full px-6 font-semibold">
            <Link to={session ? '/playlists' : '/'}>{session ? '목록으로' : '홈으로'}</Link>
          </Button>
        </div>
      ) : query.isError || !detail ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">플레이리스트를 불러오지 못했어요</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
            className="rounded-full px-6 font-semibold"
          >
            다시 시도
          </Button>
        </div>
      ) : (
        <>
          <div className="pt-4">
            <h1 className="text-[26px] font-black leading-tight tracking-[-0.02em]">{detail.title}</h1>
            {detail.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{detail.description}</p>
            )}
            <p className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
              {detail.tracks.length}곡
              <span aria-hidden>·</span>
              {detail.is_public ? (
                <span className="inline-flex items-center gap-0.5"><Globe className="size-3.5" /> 공개</span>
              ) : (
                <span className="inline-flex items-center gap-0.5"><Lock className="size-3.5" /> 비공개</span>
              )}
            </p>
          </div>

          {detail.tracks.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-16 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-brand/12 text-brand">
                <ListMusic className="size-6" />
              </span>
              <div>
                <p className="text-[17px] font-extrabold tracking-tight">아직 담긴 곡이 없어요</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {isOwner ? (
                    <>
                      즐겨찾기 목록에서 곡의 담기 버튼을 누르면
                      <br />
                      여기에 담을 수 있어요
                    </>
                  ) : (
                    '아직 채워지지 않은 플레이리스트예요'
                  )}
                </p>
              </div>
              {isOwner && (
                <Button asChild size="lg" className="h-12 rounded-full px-7 text-sm font-bold transition-transform active:scale-[0.97]">
                  <Link to="/favorites">
                    <Heart /> 즐겨찾기에서 담으러 가기
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              {isOwner && detail.tracks.length > 1 && (
                <div className="mt-4 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setReordering((v) => !v)}
                    className="rounded-full text-muted-foreground hover:text-foreground"
                  >
                    {reordering ? '완료' : '순서 편집'}
                  </Button>
                </div>
              )}

              <motion.ul
                variants={listVariants}
                initial="hidden"
                animate="show"
                className={reordering ? 'mt-2 flex flex-col gap-2.5' : 'mt-4 flex flex-col gap-2.5'}
              >
                {detail.tracks.map((t, i) => (
                  <TrackRow
                    key={t.music.id}
                    t={t}
                    reordering={isOwner && reordering}
                    canEdit={isOwner}
                    first={i === 0}
                    last={i === detail.tracks.length - 1}
                    busy={reorder.isPending || trackRemoval.isPending}
                    onMoveUp={() => moveTrack(i, -1)}
                    onMoveDown={() => moveTrack(i, 1)}
                    onRemove={() => trackRemoval.mutate(t.music.id)}
                  />
                ))}
              </motion.ul>
            </>
          )}
        </>
      )}

      {detail && (
        <PlaylistFormSheet
          open={editing}
          onClose={() => setEditing(false)}
          initial={{
            title: detail.title,
            description: detail.description ?? '',
            is_public: detail.is_public,
          }}
          pending={update.isPending}
          onSubmit={(values) => update.mutate(values)}
        />
      )}

      <BottomSheet open={confirmingDelete} onClose={() => setConfirmingDelete(false)}>
        <h2 className="text-[17px] font-extrabold tracking-tight">플레이리스트를 삭제할까요?</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          담긴 곡 목록도 함께 사라져요. 곡 자체와 즐겨찾기는 그대로예요.
        </p>
        <Button
          type="button"
          variant="destructive"
          size="lg"
          disabled={removal.isPending}
          onClick={() => removal.mutate()}
          className="mt-5 h-12 w-full rounded-full text-[15px] font-bold"
        >
          {removal.isPending ? '삭제 중…' : '삭제하기'}
        </Button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(false)}
          className="mt-3 w-full py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          취소
        </button>
      </BottomSheet>
    </div>
  )
}

function TrackRow({
  t,
  reordering,
  canEdit,
  first,
  last,
  busy,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  t: PlaylistTrack
  reordering: boolean
  canEdit: boolean
  first: boolean
  last: boolean
  busy: boolean
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}) {
  const m = t.music
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
        {reordering ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={first || busy}
              onClick={onMoveUp}
              className="rounded-full text-muted-foreground hover:text-foreground"
              aria-label="위로 이동"
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={last || busy}
              onClick={onMoveDown}
              className="rounded-full text-muted-foreground hover:text-foreground"
              aria-label="아래로 이동"
            >
              <ArrowDown />
            </Button>
          </>
        ) : (
          <>
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
            {canEdit && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={onRemove}
                className="rounded-full text-muted-foreground transition-transform hover:text-destructive active:scale-90"
                aria-label="플레이리스트에서 빼기"
              >
                <X />
              </Button>
            )}
          </>
        )}
      </div>
    </motion.li>
  )
}
