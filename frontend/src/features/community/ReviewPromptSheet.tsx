import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/BottomSheet'
import { track } from '@/features/events/track'
import { deferReviewPrompt } from '@/features/community/api'
import { ReviewFormSheet } from '@/features/community/ReviewFormSheet'

interface Props {
  open: boolean
  onClose: () => void
}

/**
 * 리뷰 작성 유도 시트(spec 005 US4) — 누적 검색 3회 자격자에게 검색 결과 화면에서
 * 노출. "작성하기"는 리뷰 폼으로 잇고, "나중에"는 서버 유예(7일)를 저장한다.
 * 선택 없이 닫으면 세션 가드만 남는다(노출 시점에 이미 마킹됨 — reviewPrompt.ts).
 */
export function ReviewPromptSheet({ open, onClose }: Props) {
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    if (open) track('review_prompt_shown')
  }, [open])

  const defer = useMutation({
    mutationFn: deferReviewPrompt,
    // 실패해도 조용히 닫는다 — 세션 가드가 있어 이번 세션 재노출은 없고, 최악이 다음 세션 재유도
    onSettled: onClose,
  })

  const onLater = () => {
    track('review_prompt_later')
    defer.mutate()
  }

  return (
    <>
      <BottomSheet open={open && !formOpen} onClose={onClose}>
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-iris/15 text-iris-soft">
          <Star className="size-5" />
        </span>
        <h2 className="mt-3 text-center text-[17px] font-extrabold tracking-tight">
          Melolist, 어떠셨나요?
        </h2>
        <p className="mt-1.5 text-center text-sm leading-relaxed text-muted-foreground">
          벌써 세 번이나 곡을 찾으셨어요!
          <br />
          짧은 리뷰가 큰 힘이 돼요
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            size="lg"
            onClick={() => setFormOpen(true)}
            className="h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
          >
            리뷰 작성하기
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={defer.isPending}
            onClick={onLater}
            className="h-12 w-full rounded-full text-[15px] font-semibold text-muted-foreground"
          >
            나중에 할게요
          </Button>
        </div>
      </BottomSheet>

      <ReviewFormSheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          onClose()
        }}
        initial={null}
      />
    </>
  )
}
