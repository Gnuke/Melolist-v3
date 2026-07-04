import { motion } from 'motion/react'
import { Mic } from 'lucide-react'

interface Props {
  recording: boolean
  disabled?: boolean
  onClick: () => void
}

const CENTER = 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'

/** Apple Siri급 인터랙션 마이크 버튼: 앰비언트 글로우 · 회전 쉰 · 녹음 시 펄스 링 · spring hover/tap. */
export function MicButton({ recording, disabled = false, onClick }: Props) {
  return (
    <div className="relative flex size-60 items-center justify-center">
      {/* 앰비언트 글로우 */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl"
        style={{
          background: recording
            ? 'radial-gradient(circle, rgba(239,68,68,0.55), transparent 68%)'
            : 'radial-gradient(circle, rgba(91,140,255,0.5), transparent 68%)',
        }}
        animate={{
          scale: recording ? [1, 1.18, 1] : [1, 1.08, 1],
          opacity: recording ? [0.6, 0.95, 0.6] : [0.45, 0.65, 0.45],
        }}
        transition={{ duration: recording ? 1.5 : 4.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* 회전하는 conic 쉰 (대기 상태) */}
      {!recording && (
        <motion.div
          aria-hidden
          className={`${CENTER} pointer-events-none size-44 rounded-full opacity-50 blur-md`}
          style={{
            background: 'conic-gradient(from 0deg, #5b8cff, #7ea6ff, #3d6bde, #5b8cff)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* 펄스 링 (녹음 중) */}
      {recording &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className={`${CENTER} pointer-events-none rounded-full border border-red-500/40`}
            initial={{ width: 144, height: 144, opacity: 0.5 }}
            animate={{ width: 236, height: 236, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          />
        ))}

      {/* 코어 버튼 */}
      <motion.button
        type="button"
        onClick={onClick}
        disabled={disabled}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        animate={recording ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={
          recording
            ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' }
            : { type: 'spring', stiffness: 360, damping: 18 }
        }
        className="relative z-10 flex size-36 items-center justify-center rounded-full disabled:opacity-60"
        style={{
          background: recording
            ? 'linear-gradient(150deg, #ff6b6b, #dc2626)'
            : 'linear-gradient(150deg, #6f9bff, #3d6bde)',
          boxShadow: recording
            ? '0 8px 40px rgba(239,68,68,0.5), inset 0 2px 3px rgba(255,255,255,0.35), inset 0 -6px 12px rgba(0,0,0,0.25)'
            : '0 14px 48px rgba(91,140,255,0.45), inset 0 2px 3px rgba(255,255,255,0.45), inset 0 -6px 14px rgba(0,0,0,0.3)',
        }}
        aria-label={recording ? '녹음 중' : '녹음 시작'}
      >
        <Mic className="size-14 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" strokeWidth={2.2} />
      </motion.button>
    </div>
  )
}
