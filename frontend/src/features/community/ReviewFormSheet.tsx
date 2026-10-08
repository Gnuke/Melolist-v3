import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'
import { track } from '@/features/events/track'
import { createReview, getMyReview, updateReview, type Review } from '@/features/community/api'

interface Props {
  open: boolean
  onClose: () => void
  /** 수정이면 기존 리뷰, 새 작성이면 null */
  initial: Review | null
}

const CONTENT_MAX = 500

/**
 * 서비스 리뷰 작성·수정 시트(spec 005 US2) — 별점(1~5 필수)+내용(≤500자).
 * 1인 1리뷰라 작성 중 409(다른 기기·탭 경합 포함)를 만나면 기존 리뷰를 불러와
 * 그 자리에서 수정 모드로 전환한다(계약 §6).
 */
export function ReviewFormSheet({ open, onClose, initial }: Props) {
  const queryClient = useQueryClient()
  const [target, setTarget] = useState<Review | null>(initial)
  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')

  // 열릴 때마다 초기값으로 리셋 — 닫았다 다시 열면 이전 입력이 남지 않는다
  useEffect(() => {
    if (!open) return
    setTarget(initial)
    setRating(initial?.rating ?? 0)
    setContent(initial?.content ?? '')
  }, [open, initial])

  const isEdit = target != null
  const valid = rating >= 1 && rating <= 5 && content.trim().length > 0

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? updateReview(target.id, { rating, content: content.trim() })
        : createReview(rating, content.trim()),
    onSuccess: (saved) => {
      track('review_submit', { rating, is_edit: isEdit })
      queryClient.invalidateQueries({ queryKey: ['reviews'] })
      queryClient.setQueryData(['my-review'], saved)
      toast(isEdit ? '리뷰를 수정했어요' : '리뷰를 남겼어요')
      onClose()
    },
    onError: async (err) => {
      // 1인 1리뷰 경합(409) — 기존 리뷰를 불러와 수정으로 이어간다
      if (isAxiosError(err) && err.response?.status === 409) {
        try {
          const mine = await getMyReview()
          if (mine) {
            setTarget(mine)
            setRating(mine.rating)
            setContent(mine.content)
            queryClient.setQueryData(['my-review'], mine)
            toast('이미 작성한 리뷰가 있어요 — 수정으로 이어가요')
            return
          }
        } catch {
          // 조회 실패 시 일반 오류 안내로 폴백
        }
      }
      toast('저장하지 못했어요 — 잠시 후 다시 시도해주세요')
    },
  })

  const pending = mutation.isPending

  return (
    <BottomSheet open={open} onClose={pending ? () => undefined : onClose}>
      <h2 className="text-[17px] font-extrabold tracking-tight">
        {isEdit ? '리뷰 수정' : 'Melolist는 어땠나요?'}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">서비스 전반에 대한 별점과 소감을 남겨주세요</p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid || pending) return
          mutation.mutate()
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <div className="flex items-center justify-center gap-1.5 py-2" role="radiogroup" aria-label="별점">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`별점 ${value}점`}
              onClick={() => setRating(value)}
              className="rounded-full p-1 transition-transform active:scale-90"
            >
              <Star
                className={cn(
                  'size-8',
                  value <= rating ? 'fill-warning text-warning' : 'text-muted-foreground/40',
                )}
              />
            </button>
          ))}
        </div>

        <div className="relative">
          <textarea
            value={content}
            rows={4}
            maxLength={CONTENT_MAX}
            onChange={(e) => setContent(e.target.value)}
            placeholder="어떤 점이 좋았는지, 아쉬웠는지 들려주세요"
            className="w-full resize-none rounded-xl border border-input bg-secondary/60 px-4 py-3 text-[15px] outline-none placeholder:text-muted-foreground/60 focus:border-foreground/20"
          />
          <span className="pointer-events-none absolute bottom-2.5 right-3 text-xs tabular-nums text-muted-foreground/60">
            {content.length}/{CONTENT_MAX}
          </span>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={!valid || pending}
          className="mt-1 h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
        >
          {pending ? '저장 중…' : isEdit ? '수정하기' : '리뷰 남기기'}
        </Button>
      </form>
    </BottomSheet>
  )
}
