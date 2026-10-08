import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { deleteReview, getMyReview, getReviews, type Review } from '@/features/community/api'
import { ReviewFormSheet } from '@/features/community/ReviewFormSheet'
import { ProfileAvatar } from '@/features/user/ProfileAvatar'

const PAGE_SIZE = 20

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
}
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
}

/**
 * 서비스 리뷰 피드(spec 005 US2) — 조회는 게스트 허용, 작성은 로그인 전용(1인 1건).
 * 이미 리뷰가 있으면 CTA가 수정으로 이어진다. 내용은 플레인 텍스트로만 렌더(R9).
 */
export function ReviewsFeed() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null)

  const query = useInfiniteQuery({
    queryKey: ['reviews'],
    queryFn: ({ pageParam }) => getReviews(pageParam, PAGE_SIZE),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.page + 1 < last.total_pages ? last.page + 1 : undefined),
  })

  const myReview = useQuery({
    queryKey: ['my-review'],
    queryFn: getMyReview,
    enabled: !!session,
  })

  const removal = useMutation({
    mutationFn: (id: number) => deleteReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.setQueryData(['my-review'], null)
      setDeleteTarget(null)
      toast('리뷰를 삭제했어요 — 언제든 다시 남길 수 있어요')
    },
    onError: () => toast('삭제하지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  // 게스트가 작성을 시도하면 로그인 유도 후 리뷰 세그먼트로 복귀(FR-008, state.next)
  const openForm = () => {
    if (!session) {
      navigate('/login', { state: { next: '/community?segment=reviews' } })
      return
    }
    setFormOpen(true)
  }

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const mine = myReview.data ?? null
  const ctaLabel = mine ? '내 리뷰 수정' : '리뷰 쓰기'

  return (
    <>
      {!query.isPending && !query.isError && items.length > 0 && (
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={openForm}
            className="rounded-full px-4 font-bold transition-transform active:scale-[0.97]"
          >
            <Pencil /> {ctaLabel}
          </Button>
        </div>
      )}

      {query.isPending ? (
        <div className="mt-5 flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2.5 rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">리뷰를 불러오지 못했어요</p>
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
            <Star className="size-6" />
          </span>
          <div>
            <p className="text-[17px] font-extrabold tracking-tight">아직 등록된 리뷰가 없어요</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Melolist를 써본 소감을
              <br />
              가장 먼저 남겨보세요
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={openForm}
            className="h-12 rounded-full px-7 text-sm font-bold transition-transform active:scale-[0.97]"
          >
            <Pencil /> 리뷰 남기기
          </Button>
        </div>
      ) : (
        <>
          <motion.ul variants={listVariants} initial="hidden" animate="show" className="mt-3 flex flex-col gap-2.5">
            {items.map((r) => (
              <ReviewRow
                key={r.id}
                review={r}
                isMine={!!user && r.author?.id === user.id}
                onEdit={() => setFormOpen(true)}
                onDelete={() => setDeleteTarget(r)}
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

      <ReviewFormSheet open={formOpen} onClose={() => setFormOpen(false)} initial={mine} />

      <BottomSheet open={deleteTarget != null} onClose={() => setDeleteTarget(null)}>
        <h2 className="text-[17px] font-extrabold tracking-tight">리뷰를 삭제할까요?</h2>
        <p className="mt-1 text-sm text-muted-foreground">삭제해도 언제든 새 리뷰를 남길 수 있어요</p>
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
    </>
  )
}

function formatDate(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function ReviewRow({
  review,
  isMine,
  onEdit,
  onDelete,
}: {
  review: Review
  isMine: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const authorName = review.author?.display_name ?? '알 수 없음'
  return (
    <motion.li
      variants={itemVariants}
      layout
      className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-4"
    >
      <div className="flex items-center gap-2.5">
        <ProfileAvatar avatarUrl={review.author?.avatar_url} label={authorName} className="size-7 text-[12px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold">
            {authorName}
            {isMine && <span className="ml-1.5 text-xs font-semibold text-iris-soft">내 리뷰</span>}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(review.created_at)}</p>
        </div>
        {isMine && (
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onEdit}
              className="rounded-full text-muted-foreground hover:text-foreground"
              aria-label="내 리뷰 수정"
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onDelete}
              className="rounded-full text-muted-foreground hover:text-destructive"
              aria-label="내 리뷰 삭제"
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-0.5" aria-label={`별점 ${review.rating}점`}>
        {[1, 2, 3, 4, 5].map((v) => (
          <Star
            key={v}
            aria-hidden
            className={cn('size-3.5', v <= review.rating ? 'fill-warning text-warning' : 'text-muted-foreground/30')}
          />
        ))}
      </div>

      {/* 사용자 입력은 플레인 텍스트로만 — v2 v-html XSS 계승 차단(R9), 줄바꿈은 CSS로 */}
      <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{review.content}</p>
    </motion.li>
  )
}
