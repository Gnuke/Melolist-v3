import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * 바텀 시트 공용 셸(FavoriteSheet 패턴 추출) — 백드롭·ESC로 닫힌다.
 * 내용은 children으로, 닫힘이 파괴적인 경우는 QuitConfirmSheet처럼 전용 구현을 쓴다.
 */
export function BottomSheet({ open, onClose, children }: Props) {
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
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
