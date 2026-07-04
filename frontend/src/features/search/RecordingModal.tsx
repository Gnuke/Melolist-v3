import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Pause, Play, Square } from 'lucide-react'

interface Props {
  stream: MediaStream
  onSave: (blob: Blob) => void
  onStop: () => void
}

function formatTime(t: number): string {
  const m = Math.floor(t / 60).toString().padStart(2, '0')
  const s = Math.floor(t % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
}

export function RecordingModal({ stream, onSave, onStop }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const stopFnRef = useRef<() => void>(() => {})
  const rafRef = useRef<number | null>(null)
  const pausedRef = useRef(false)

  const [seconds, setSeconds] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    // ⚠️ chunks는 이 이펙트 실행(=이 녹음기)의 클로저가 독립 소유한다.
    // StrictMode 이중 실행이나 재마운트에서도 다른 녹음기 데이터와 섞이지 않는다.
    const chunks: BlobPart[] = []

    const audioCtx = new AudioContext()
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048
    const source = audioCtx.createMediaStreamSource(stream)
    source.connect(analyser)

    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.start(200) // timeslice: 녹음 중에도 200ms마다 데이터 수집
    recorderRef.current = recorder

    // 정지 버튼 → 이 녹음기의 chunks로 blob 생성 후 저장
    stopFnRef.current = () => {
      // 종료 애니메이션과 경쟁하지 않도록 캔버스 draw 루프를 즉시 멈춘다.
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (recorder.state !== 'inactive') {
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
          onSave(blob)
          onStop()
        }
        recorder.stop()
      } else {
        onStop()
      }
    }

    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = canvas.offsetWidth || 320
      canvas.height = 140
    }

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const c = canvasRef.current
      const ctx = c?.getContext('2d')
      if (!c || !ctx) return
      const buffer = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteTimeDomainData(buffer)

      ctx.clearRect(0, 0, c.width, c.height)
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#ef4444'
      ctx.shadowBlur = 12
      ctx.shadowColor = 'rgba(239,68,68,0.6)'
      ctx.beginPath()
      const slice = c.width / buffer.length
      let x = 0
      for (let i = 0; i < buffer.length; i++) {
        const v = (buffer[i] ?? 128) / 128
        const y = (v * c.height) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += slice
      }
      ctx.lineTo(c.width, c.height / 2)
      ctx.stroke()
    }
    draw()

    const timer = window.setInterval(() => {
      if (!pausedRef.current) setSeconds((s) => s + 1)
    }, 1000)

    return () => {
      window.clearInterval(timer)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      try {
        source.disconnect()
      } catch {
        // ignore
      }
      void audioCtx.close().catch(() => undefined)
      // 정리 시엔 '저장하지 않고' 이 녹음기만 종료 (chunks 폐기)
      if (recorder.state !== 'inactive') {
        recorder.onstop = null
        try {
          recorder.stop()
        } catch {
          // ignore
        }
      }
    }
    // stream 단위로만 재생성. onSave/onStop은 functional setState라 stale-safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream])

  const handleStop = () => {
    stopFnRef.current()
  }

  const togglePause = () => {
    const r = recorderRef.current
    if (!r || r.state === 'inactive') return
    const next = !paused
    setPaused(next)
    pausedRef.current = next
    try {
      if (next) r.pause()
      else r.resume()
    } catch {
      // ignore
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(14px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-card p-7 shadow-2xl"
        initial={{ scale: 0.92, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <motion.span
              className="size-2.5 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            녹음 중
          </div>

          <p className="text-5xl font-semibold tabular-nums tracking-tight">{formatTime(seconds)}</p>

          <canvas ref={canvasRef} className="h-[140px] w-full rounded-2xl bg-black/40" />

          <div className="flex items-center gap-8">
            <motion.button
              type="button"
              onClick={togglePause}
              whileTap={{ scale: 0.9 }}
              className="flex size-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
              aria-label={paused ? '재개' : '일시정지'}
            >
              {paused ? <Play className="size-6" /> : <Pause className="size-6" />}
            </motion.button>
            <motion.button
              type="button"
              onClick={handleStop}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              className="flex size-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30"
              aria-label="정지"
            >
              <Square className="size-6 fill-current" />
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
