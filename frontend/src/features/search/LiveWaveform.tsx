import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

interface Props {
  /** useRecorder의 AnalyserNode — 있는 동안만 그린다 */
  analyserRef: RefObject<AnalyserNode | null>
  active: boolean
}

const BAR_COUNT = 44
const BAR_WIDTH = 3
const GAP = 3

/**
 * 허밍 녹음 중 실시간 파형(와이어프레임 1f) — 대칭 바가 우측에서 유입되어 좌로 흐른다.
 * 지나간 바 = iris, 센터라인 = ink.
 */
export function LiveWaveform({ analyserRef, active }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = (BAR_COUNT * (BAR_WIDTH + GAP) - GAP) as number
    const height = 56
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const history = new Array<number>(BAR_COUNT).fill(0)
    const buffer = new Uint8Array(2048)
    let raf = 0
    let lastPush = 0

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      const analyser = analyserRef.current
      if (!analyser) return

      // ~70ms마다 한 칸씩 좌로 흘린다
      if (now - lastPush > 70) {
        lastPush = now
        const data = buffer.subarray(0, analyser.fftSize)
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = ((data[i] ?? 128) - 128) / 128
          sum += v * v
        }
        history.shift()
        history.push(Math.min(1, Math.sqrt(sum / data.length) * 5))
      }

      ctx.clearRect(0, 0, width, height)
      // 센터라인
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(0, height / 2 - 0.5, width, 1)

      for (let i = 0; i < BAR_COUNT; i++) {
        const level = history[i] ?? 0
        const h = Math.max(3, level * (height - 8))
        const x = i * (BAR_WIDTH + GAP)
        const alpha = 0.35 + (i / BAR_COUNT) * 0.65 // 최신(우측)일수록 진하게
        ctx.fillStyle = `rgba(139, 124, 255, ${alpha.toFixed(2)})` // iris-400
        const y = (height - h) / 2
        ctx.beginPath()
        ctx.roundRect(x, y, BAR_WIDTH, h, 2)
        ctx.fill()
      }
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [active, analyserRef])

  return <canvas ref={canvasRef} className="h-14" style={{ width: BAR_COUNT * (BAR_WIDTH + GAP) - GAP }} />
}
