import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListMusic, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BottomSheet } from '@/components/BottomSheet'
import { useAuthStore } from '@/stores/authStore'
import { addTrack, createPlaylist, getPlaylists } from './api'

interface Props {
  /** 담을 곡의 music id — null이면 닫힘 */
  musicId: number | null
  onClose: () => void
}

/** 곡을 내 플레이리스트에 담는 선택 시트 — 기존 목록에서 고르거나 새로 만들어 바로 담는다. */
export function AddToPlaylistSheet({ musicId, onClose }: Props) {
  const open = musicId !== null
  const session = useAuthStore((s) => s.session)
  const queryClient = useQueryClient()
  const [newTitle, setNewTitle] = useState<string | null>(null) // null = 목록 모드, 문자열 = 새로 만들기 모드

  useEffect(() => {
    if (open) setNewTitle(null)
  }, [open])

  const query = useQuery({
    queryKey: ['playlists'],
    queryFn: getPlaylists,
    enabled: open && !!session,
  })

  const finish = (playlistId: number) => {
    queryClient.invalidateQueries({ queryKey: ['playlists'] })
    queryClient.invalidateQueries({ queryKey: ['playlist', playlistId] })
    toast('플레이리스트에 담았어요')
    onClose()
  }

  const addition = useMutation({
    mutationFn: (playlistId: number) => addTrack(playlistId, musicId!),
    onSuccess: (_data, playlistId) => finish(playlistId),
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 409) {
        toast('이미 담겨 있는 곡이에요')
        onClose()
        return
      }
      toast('담지 못했어요 — 잠시 후 다시 시도해주세요')
    },
  })

  const createAndAdd = useMutation({
    mutationFn: async (title: string) => {
      const created = await createPlaylist({ title, description: '', is_public: false })
      await addTrack(created.id, musicId!)
      return created.id
    },
    onSuccess: (playlistId) => finish(playlistId),
    onError: () => toast('담지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  const pending = addition.isPending || createAndAdd.isPending
  const playlists = query.data ?? []
  const creatingMode = newTitle !== null || (!query.isPending && playlists.length === 0)

  return (
    <BottomSheet open={open} onClose={pending ? () => undefined : onClose}>
      <h2 className="text-[17px] font-extrabold tracking-tight">플레이리스트에 담기</h2>

      {creatingMode ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const title = (newTitle ?? '').trim()
            if (!title || pending) return
            createAndAdd.mutate(title)
          }}
          className="mt-4 flex flex-col gap-3"
        >
          <input
            type="text"
            value={newTitle ?? ''}
            maxLength={120}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="새 플레이리스트 제목"
            autoFocus
            className="w-full rounded-xl border border-white/10 bg-secondary/60 px-4 py-3 text-[15px] outline-none placeholder:text-muted-foreground/60 focus:border-white/20"
          />
          <Button
            type="submit"
            size="lg"
            disabled={!(newTitle ?? '').trim() || pending}
            className="h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
          >
            {pending ? '담는 중…' : '만들고 담기'}
          </Button>
          {playlists.length > 0 && (
            <button
              type="button"
              onClick={() => setNewTitle(null)}
              className="w-full py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              기존 플레이리스트에서 고르기
            </button>
          )}
        </form>
      ) : query.isPending ? (
        <div className="mt-4 flex flex-col gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-white/7 bg-card/60 p-3">
              <Skeleton className="size-10 shrink-0 rounded-[8px]" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="mt-5 flex flex-col items-center gap-3 pb-2 text-center">
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
      ) : (
        <>
          <ul className="mt-4 flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
            {playlists.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => addition.mutate(p.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/7 bg-card/60 p-3 text-left transition-colors hover:bg-secondary/60 disabled:opacity-50"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-secondary text-muted-foreground/60">
                    <ListMusic className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{p.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {p.track_count}곡 · {p.is_public ? '공개' : '비공개'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={pending}
            onClick={() => setNewTitle('')}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
          >
            <Plus className="size-4" /> 새 플레이리스트
          </button>
        </>
      )}
    </BottomSheet>
  )
}
