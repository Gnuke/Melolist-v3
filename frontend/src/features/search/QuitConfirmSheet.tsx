import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  icon: LucideIcon
  title: string
  body: string
  continueLabel: string
  quitLabel: string
  /** 안전한 기본 동작 — 백드롭·ESC도 여기로 온다 (하던 일 계속) */
  onContinue: () => void
  onQuit: () => void
}

/**
 * 녹음/검색 취소 확인 바텀 시트 — 취소 버튼이 하던 일을 즉시 날리지 않도록
 * 의사를 한 번 확인한다(FavoriteSheet 패턴). 주 버튼 = 계속하기(안전한 쪽).
 */
export function QuitConfirmSheet({ open, icon: Icon, title, body, continueLabel, quitLabel, onContinue, onQuit }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onContinue()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onContinue])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onContinue}
          />
          <motion.div
            className="relative w-full max-w-md rounded-t-[24px] border-t border-white/10 bg-card px-6 pb-8 pt-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-white/15" />
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                <Icon className="size-5" />
              </div>
              <h2 className="text-[17px] font-extrabold leading-snug tracking-tight">{title}</h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
            <Button
              type="button"
              onClick={onContinue}
              size="lg"
              className="mt-5 h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
            >
              {continueLabel}
            </Button>
            <button
              type="button"
              onClick={onQuit}
              className="mt-3 w-full py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {quitLabel}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
