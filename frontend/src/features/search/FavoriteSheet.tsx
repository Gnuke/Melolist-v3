import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  onLogin: () => void
}

/**
 * 즐겨찾기 로그인 유도 바텀 시트(C6·D4, 와이어프레임 1l).
 * 저장 동작 자체는 M3 — 여기서는 게스트→가입 전환만 유도한다.
 */
export function FavoriteSheet({ open, onClose, onLogin }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-md rounded-t-[24px] border-t border-input bg-card px-6 pb-8 pt-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-foreground/15" />
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                <Heart className="size-5" />
              </div>
              <h2 className="text-[17px] font-extrabold leading-snug tracking-tight">
                로그인하면 이 곡을
                <br />
                저장할 수 있어요
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              찾은 곡을 즐겨찾기에 모아두고 언제든 다시 보세요
            </p>
            <Button
              type="button"
              onClick={onLogin}
              size="lg"
              className="mt-5 h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
            >
              로그인
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              나중에 할게요
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
