import { useEffect, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { motion } from 'motion/react'

const BAR_COUNT = 40
const BAR_RADIUS = 84 // 바 중심의 궤도 반지름 (코어 128px 밖)

interface Props {
  /** useRecorder의 실시간 RMS(0~1) — 리렌더 없이 rAF로 직접 읽는다 */
  levelRef: RefObject<number>
  /** 0~1 진행률 — 경과분 바가 iris로 채워지고 스위프 헤드는 flame (와이어프레임 1h) */
  getProgress: () => number
  active: boolean
  /** 중앙 코어(마이크·타이머) */
  children?: ReactNode
}

/**
 * 인식 링 — Melolist의 시그니처.
 * 마이크 레벨에 맞춰 춤추는 방사형 바가 카운트다운 진행률을 겸한다:
 * 지나간 바 = iris(인식 순간), 진행 헤드 = flame, 남은 바 = ink.
 */
export function RecognitionRing({ levelRef, getProgress, active, children }: Props) {
  const barsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    if (!active) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()

    const tick = () => {
      raf = requestAnimationFrame(tick)
      const level = Math.min(1, (levelRef.current ?? 0) * 6)
      const progress = getProgress()
      const head = Math.floor(progress * BAR_COUNT)
      const t = (performance.now() - t0) / 1000

      for (let i = 0; i < BAR_COUNT; i++) {
        const el = barsRef.current[i]
        if (!el) continue
        const angle = (i / BAR_COUNT) * 360
        // 바마다 위상이 다른 물결 + 레벨 반응 (reduced-motion이면 진행률 정보만)
        const wobble = reduced ? 0.45 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 5.2 + i * 1.7))
        const scale = 0.22 + level * wobble * 0.78
        el.style.transform = `rotate(${angle}deg) translateY(-${BAR_RADIUS}px) scaleY(${scale.toFixed(3)})`
        el.style.background =
          i < head ? 'var(--iris-400)' : i === head ? 'var(--flame-500)' : 'var(--ink-600)'
      }
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active, levelRef, getProgress])

  return (
    <div className="relative flex size-60 items-center justify-center">
      {/* 앰비언트 글로우 — 인식(발견) 순간은 iris */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(110,92,255,0.4), transparent 68%)' }}
        animate={active ? { scale: [1, 1.14, 1], opacity: [0.5, 0.85, 0.5] } : { opacity: 0.3 }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* 방사형 바 */}
      <div aria-hidden className="absolute inset-0">
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              barsRef.current[i] = el
            }}
            className="absolute left-1/2 top-1/2 -ml-[1.5px] -mt-[17px] h-[34px] w-[3px] rounded-full"
            style={{
              background: 'var(--ink-600)',
              transform: `rotate(${(i / BAR_COUNT) * 360}deg) translateY(-${BAR_RADIUS}px) scaleY(0.25)`,
            }}
          />
        ))}
      </div>

      {/* 코어 */}
      <div
        className="relative z-10 flex size-32 flex-col items-center justify-center gap-1 rounded-full border border-white/10"
        style={{
          background: 'linear-gradient(165deg, var(--ink-800), var(--ink-900))',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 16px 48px rgba(0,0,0,0.55)',
        }}
      >
        {children}
      </div>
    </div>
  )
}
