import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import WaveSurfer from 'wavesurfer.js'
import { Pause, Play } from 'lucide-react'

interface Props {
  url: string
}

function formatTime(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00'
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

/**
 * 녹음 확인 카드(허밍 D2) — WaveSurfer가 <audio>를 media로 제어한다.
 * 커서/진행은 WaveSurfer 내부 rAF로 60fps, 시간 텍스트만 초 단위 갱신.
 */
export function PlaybackCard({ url }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    const audioEl = audioRef.current
    if (!url || !container || !audioEl) return

    const ws = WaveSurfer.create({
      container,
      media: audioEl,
      waveColor: '#3a3a42', // ink-600
      progressColor: '#8b7cff', // iris-400 — 인식 순간의 트레일
      cursorColor: '#ab9fff',
      barWidth: 2,
      barRadius: 3,
      barGap: 2,
      height: 64,
    })
    // destroy()가 로드 중인 fetch를 중단시키면 이 프라미스가 AbortError로 거부된다
    // (StrictMode 이중 이펙트·빠른 언마운트에서 상시 발생) — 의도된 중단이라 삼킨다
    ws.load(url).catch(() => {})
    wsRef.current = ws

    ws.on('ready', () => setDuration(ws.getDuration()))
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => {
      setIsPlaying(false)
      setCurrentTime(0)
      void ws.seekTo(0)
    })
    ws.on('timeupdate', (t: number) =>
      setCurrentTime((prev) => (Math.floor(prev) === Math.floor(t) ? prev : t)),
    )

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [url])

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-4">
      <div className="flex items-center gap-3">
        {/* DS: 플레이 버튼만 flame + 글로우를 가진다 */}
        <motion.button
          type="button"
          onClick={() => void wsRef.current?.playPause()}
          whileTap={{ scale: 0.92 }}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow-flame"
          aria-label={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? <Pause className="size-5" /> : <Play className="size-5 translate-x-0.5" />}
        </motion.button>
        <div ref={containerRef} className="min-w-0 flex-1" />
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {formatTime(isPlaying ? currentTime : duration)}
        </span>
      </div>
      <p className="text-[13px] text-muted-foreground">들어보고 마음에 안 들면 다시 부르면 돼요</p>
      {/* WaveSurfer(media)가 이 엘리먼트로 재생을 제어한다 */}
      <audio ref={audioRef} preload="auto" className="hidden" />
    </div>
  )
}
