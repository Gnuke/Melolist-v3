import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LogIn, MessageCircle, SendHorizonal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BottomSheet } from '@/components/BottomSheet'
import { useAuthStore } from '@/stores/authStore'
import { track } from '@/features/events/track'
import { createComment, deleteComment, getComments, type PlaylistComment } from '@/features/community/api'
import { ProfileAvatar } from '@/features/user/ProfileAvatar'

const CONTENT_MAX = 300

/**
 * 공개 플레이리스트 댓글(spec 005 US3) — 목록은 게스트 포함 조회, 작성은 로그인
 * 전용(≤300자), 삭제는 작성자 본인만. 내용은 플레인 텍스트로만 렌더(R9).
 * 상세 화면이 조회 가능(공개 또는 소유)일 때만 마운트된다.
 */
export function CommentsSection({ playlistId }: { playlistId: number }) {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<PlaylistComment | null>(null)

  const query = useQuery({
    queryKey: ['comments', playlistId],
    queryFn: () => getComments(playlistId),
  })

  const creation = useMutation({
    mutationFn: (text: string) => createComment(playlistId, text),
    onSuccess: () => {
      track('comment_submit', { playlist_id: playlistId })
      queryClient.invalidateQueries({ queryKey: ['comments', playlistId] })
      setContent('')
    },
    onError: (err) => {
      if (isAxiosError(err) && err.response?.status === 404) {
        toast('더 이상 공개된 플레이리스트가 아니에요')
        return
      }
      toast('댓글을 남기지 못했어요 — 잠시 후 다시 시도해주세요')
    },
  })

  const removal = useMutation({
    mutationFn: (id: number) => deleteComment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', playlistId] })
      setDeleteTarget(null)
      toast('댓글을 삭제했어요')
    },
    onError: () => toast('삭제하지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  const items = query.data ?? []
  const valid = content.trim().length > 0

  return (
    <section className="mt-8" aria-label="댓글">
      <h2 className="flex items-center gap-1.5 text-[17px] font-extrabold tracking-tight">
        <MessageCircle className="size-4.5" aria-hidden />
        댓글{!query.isPending && !query.isError && items.length > 0 && ` ${items.length}`}
      </h2>

      {query.isPending ? (
        <div className="mt-3 flex flex-col gap-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-start gap-2.5 rounded-2xl border border-border bg-card/60 p-3.5">
              <Skeleton className="size-7 rounded-full" />
              <div className="flex w-full flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <p className="mt-3 text-sm text-muted-foreground">댓글을 불러오지 못했어요</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          아직 댓글이 없어요 — 이 플레이리스트의 첫 감상을 남겨보세요
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2.5">
          {items.map((c) => (
            <CommentRow
              key={c.id}
              comment={c}
              isMine={!!user && c.author?.id === user.id}
              onDelete={() => setDeleteTarget(c)}
            />
          ))}
        </ul>
      )}

      {session ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid || creation.isPending) return
            creation.mutate(content.trim())
          }}
          className="mt-4 flex items-end gap-2"
        >
          <div className="relative flex-1">
            <textarea
              value={content}
              rows={2}
              maxLength={CONTENT_MAX}
              onChange={(e) => setContent(e.target.value)}
              placeholder="댓글을 남겨보세요"
              className="w-full resize-none rounded-xl border border-input bg-secondary/60 px-4 py-3 pr-14 text-[15px] outline-none placeholder:text-muted-foreground/60 focus:border-foreground/20"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs tabular-nums text-muted-foreground/60">
              {content.length}/{CONTENT_MAX}
            </span>
          </div>
          <Button
            type="submit"
            size="icon-lg"
            disabled={!valid || creation.isPending}
            className="mb-1.5 shrink-0 rounded-full"
            aria-label="댓글 등록"
          >
            <SendHorizonal />
          </Button>
        </form>
      ) : (
        // 게스트 인라인 유도 — 상세 화면은 조회 허용이라 전체 GuestPrompt 대신 입력부만 CTA(FR-008)
        <button
          type="button"
          onClick={() => navigate('/login', { state: { next: `/playlists/${playlistId}` } })}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-4 py-3.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogIn className="size-4" /> 로그인하고 댓글을 남겨보세요
        </button>
      )}

      <BottomSheet open={deleteTarget != null} onClose={() => setDeleteTarget(null)}>
        <h2 className="text-[17px] font-extrabold tracking-tight">댓글을 삭제할까요?</h2>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={removal.isPending}
            onClick={() => deleteTarget && removal.mutate(deleteTarget.id)}
            className="h-12 w-full rounded-full text-[15px] font-bold"
          >
            {removal.isPending ? '삭제 중…' : '삭제하기'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setDeleteTarget(null)}
            className="h-12 w-full rounded-full text-[15px] font-semibold text-muted-foreground"
          >
            취소
          </Button>
        </div>
      </BottomSheet>
    </section>
  )
}

function formatDate(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
}

function CommentRow({
  comment,
  isMine,
  onDelete,
}: {
  comment: PlaylistComment
  isMine: boolean
  onDelete: () => void
}) {
  const authorName = comment.author?.display_name ?? '알 수 없음'
  return (
    <li className="flex items-start gap-2.5 rounded-2xl border border-border bg-card/60 p-3.5">
      <ProfileAvatar avatarUrl={comment.author?.avatar_url} label={authorName} className="size-7 text-[12px]" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-1.5">
          <span className="truncate text-[13px] font-bold">{authorName}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatDate(comment.created_at)}</span>
        </p>
        {/* 사용자 입력은 플레인 텍스트로만 — v2 v-html XSS 계승 차단(R9) */}
        <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed">{comment.content}</p>
      </div>
      {isMine && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onDelete}
          className="shrink-0 rounded-full text-muted-foreground hover:text-destructive"
          aria-label="댓글 삭제"
        >
          <Trash2 />
        </Button>
      )}
    </li>
  )
}
