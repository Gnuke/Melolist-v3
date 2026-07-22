import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { CoverArt } from '@/features/search/CoverArt'
import { fetchAdminMusic, isAdminAuthError, updateAdminMusic } from '@/features/admin/api'
import { MusicEditForm } from '@/features/admin/MusicEditForm'
import type { MusicAdminItem, MusicAdminPatch, MusicMissingFilter, PageResponse } from '@/features/admin/types'

const PAGE_SIZE = 20

const MISSING_FILTERS: { value: MusicMissingFilter; label: string }[] = [
  { value: 'video', label: '영상 없음' },
  { value: 'cover', label: '커버 없음' },
]

/**
 * US2 곡 카탈로그 — 메타 누락 곡을 필터로 찾아 보정한다(SC-003).
 * 데스크톱 우선: 좌측 목록 + 우측 수정 패널. 저장 성공 시 서버 응답(최신 상태)으로
 * 캐시를 갱신한다(last-write-wins — 계약 §3).
 */
export function AdminMusicPage() {
  const queryClient = useQueryClient()
  const [queryText, setQueryText] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [missing, setMissing] = useState<MusicMissingFilter | null>(null)
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const params = { query: submittedQuery || undefined, missing: missing ?? undefined, page, size: PAGE_SIZE }
  const queryKey = ['admin', 'music', params] as const

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAdminMusic(params),
    placeholderData: keepPreviousData,
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: MusicAdminPatch }) => updateAdminMusic(id, patch),
    onSuccess: (saved) => {
      // 응답 = 저장 후 최신 상태 — 재조회 없이 현재 페이지 캐시에 반영
      queryClient.setQueryData<PageResponse<MusicAdminItem>>(queryKey, (data) =>
        data && { ...data, items: data.items.map((m) => (m.id === saved.id ? saved : m)) },
      )
      toast('곡 정보를 저장했어요')
    },
    onError: (err) => {
      if (!isAdminAuthError(err)) toast('저장하지 못했어요 — 입력을 확인하고 다시 시도해주세요')
    },
  })

  if (
    (query.isError && isAdminAuthError(query.error)) ||
    (update.isError && isAdminAuthError(update.error))
  ) {
    return <Navigate to="/" replace />
  }

  const data = query.data
  const items = data?.items ?? []
  const selected = items.find((m) => m.id === selectedId) ?? null

  const changeFilter = (next: MusicMissingFilter | null) => {
    setMissing(next)
    setPage(0)
    setSelectedId(null)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">곡 카탈로그</h2>
        <div className="flex flex-wrap items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setSubmittedQuery(queryText.trim())
              setPage(0)
              setSelectedId(null)
            }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="제목·아티스트 검색"
                className="h-9 w-56 rounded-full border border-input bg-foreground/4 pl-9 pr-4 text-[13px] font-medium outline-none placeholder:text-muted-foreground/60 focus:border-ring/60"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" className="rounded-full px-4 font-semibold">
              검색
            </Button>
          </form>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1">
            {MISSING_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => changeFilter(missing === f.value ? null : f.value)}
                className={cn(
                  'rounded-full px-3 py-1 text-[12px] font-semibold transition-colors',
                  missing === f.value ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 py-16 text-center">
          <p className="text-sm text-muted-foreground">목록을 불러오지 못했어요</p>
          <Button type="button" variant="outline" onClick={() => query.refetch()} className="rounded-full px-6 font-semibold">
            다시 시도
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/60 py-16 text-center text-sm text-muted-foreground">
          조건에 맞는 곡이 없어요
        </p>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-2">
            {items.map((m) => (
              <MusicRow key={m.id} m={m} selected={m.id === selectedId} onSelect={() => setSelectedId(m.id)} />
            ))}
            {data && data.total_pages > 1 && (
              <div className="mt-2 flex items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page === 0 || query.isFetching}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-full px-4 font-semibold"
                >
                  이전
                </Button>
                <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
                  {page + 1} / {data.total_pages} · 총 {data.total_items.toLocaleString()}곡
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page + 1 >= data.total_pages || query.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full px-4 font-semibold"
                >
                  다음
                </Button>
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-border bg-card/60 p-5 lg:sticky lg:top-6">
            {selected ? (
              <>
                <h3 className="mb-4 text-[15px] font-extrabold tracking-tight">곡 정보 수정</h3>
                <MusicEditForm
                  key={selected.id}
                  item={selected}
                  pending={update.isPending}
                  onSubmit={(patch) => update.mutate({ id: selected.id, patch })}
                />
              </>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                왼쪽 목록에서 곡을 선택하면
                <br />
                여기서 수정할 수 있어요
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function MusicRow({ m, selected, onSelect }: { m: MusicAdminItem; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3.5 rounded-2xl border p-3 text-left transition-colors',
        selected ? 'border-ring/50 bg-accent/60' : 'border-border bg-card/60 hover:bg-accent/40',
      )}
    >
      <CoverArt coverUrl={m.cover_url} videoId={m.youtube_video_id ?? undefined} alt={m.title} className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold">{m.title}</p>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {m.artist ?? '미상'} · {m.album ?? '—'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {m.youtube_video_id === null && <MissingBadge label="영상 없음" />}
        {m.cover_url === null && <MissingBadge label="커버 없음" />}
      </div>
    </button>
  )
}

function MissingBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning">{label}</span>
  )
}
