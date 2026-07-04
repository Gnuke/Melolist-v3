import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import WaveSurfer from 'wavesurfer.js'
import { toast } from 'sonner'
import { AudioLines, Headphones, Pause, Play, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MicButton } from './MicButton'
import { RecordingModal } from './RecordingModal'
import { SearchResultsList } from './SearchResultsList'
import { recognize } from './api'
import type { AcrResult, SearchType } from './types'

const MIN_SCORE = 50

function formatTime(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '00:00'
  const m = Math.floor(t / 60).toString().padStart(2, '0')
  const s = Math.floor(t % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function mapMicError(err: unknown): string {
  const name = (err as { name?: string })?.name
  switch (name) {
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return '마이크를 찾을 수 없습니다. 연결/설정을 확인해주세요.'
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return '마이크 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.'
    case 'NotReadableError':
    case 'TrackStartError':
      return '마이크에 접근할 수 없습니다. 다른 앱이 사용 중인지 확인해주세요.'
    case 'SecurityError':
      return '보안상 마이크 접근이 차단되었습니다. (HTTPS/localhost에서만 동작)'
    default:
      return `녹음을 시작할 수 없습니다. (${name ?? 'UnknownError'})`
  }
}

const TABS: { type: SearchType; label: string; icon: typeof Headphones }[] = [
  { type: 'fingerprint', label: '음악 찾기', icon: Headphones },
  { type: 'humming', label: '직접 부르기', icon: AudioLines },
]

export function RecordPanel() {
  const [mode, setMode] = useState<SearchType>('fingerprint')
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const [results, setResults] = useState<AcrResult[]>([])
  const [noResult, setNoResult] = useState('')
  const [lowScore, setLowScore] = useState('')
  const [loading, setLoading] = useState(false)

  const waveContainerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const wsRef = useRef<WaveSurfer | null>(null)

  const clearResults = () => {
    setResults([])
    setNoResult('')
    setLowScore('')
  }

  const resetRecording = () => {
    setRecordedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setRecordedBlob(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    clearResults()
  }

  const changeMode = (m: SearchType) => {
    if (m === mode) return
    setMode(m)
    resetRecording()
  }

  const startRecording = async () => {
    if (stream) return
    if (!navigator?.mediaDevices?.getUserMedia) {
      toast.error('이 브라우저에서는 녹음을 지원하지 않습니다.')
      return
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      if (!devices.some((d) => d.kind === 'audioinput')) {
        toast.error('오디오 장치(마이크)가 없습니다.')
        return
      }
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      resetRecording()
      setStream(s)
    } catch (err) {
      toast.error(mapMicError(err))
    }
  }

  const handleSave = (blob: Blob) => {
    setRecordedBlob(blob)
    setRecordedUrl(URL.createObjectURL(blob))
  }

  const handleStop = () => {
    setStream((s) => {
      s?.getTracks().forEach((t) => t.stop())
      return null
    })
  }

  // WaveSurfer를 <audio> 엘리먼트에 연결(media): 재생·소리·커서를 WaveSurfer가 담당.
  // 커서는 WaveSurfer가 내부 rAF로 60fps 렌더 → 부드럽게 진행. 시간 텍스트만 초 단위로 갱신.
  useEffect(() => {
    const container = waveContainerRef.current
    const audioEl = audioRef.current
    if (!recordedUrl || !container || !audioEl) return

    const ws = WaveSurfer.create({
      container,
      media: audioEl,
      waveColor: '#3f3f46',
      progressColor: '#5b8cff',
      cursorColor: '#7ea6ff',
      barWidth: 2,
      barRadius: 3,
      barGap: 2,
      height: 90,
    })
    void ws.load(recordedUrl)
    wsRef.current = ws

    ws.on('ready', () => setDuration(ws.getDuration()))
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => {
      setIsPlaying(false)
      setCurrentTime(0)
      void ws.seekTo(0)
    })
    // 시간 텍스트는 초가 바뀔 때만 갱신(리렌더 최소화). 커서는 WaveSurfer가 알아서 부드럽게.
    ws.on('timeupdate', (t: number) =>
      setCurrentTime((prev) => (Math.floor(prev) === Math.floor(t) ? prev : t)),
    )

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [recordedUrl])

  useEffect(() => {
    return () => {
      if (recordedUrl) URL.revokeObjectURL(recordedUrl)
    }
  }, [recordedUrl])

  const togglePlay = () => {
    void wsRef.current?.playPause()
  }

  const doSearch = async () => {
    if (!recordedBlob || loading) return
    setLoading(true)
    clearResults()
    try {
      const data = await recognize(mode, recordedBlob)
      if (data.length === 0) {
        setNoResult('일치하는 음악을 찾을 수 없습니다.')
        return
      }
      if (mode === 'humming') {
        const normalized = data.map((r) => ({ ...r, score: typeof r.score === 'number' ? r.score : 0 }))
        const filtered = normalized.filter((r) => (r.score ?? 0) * 100 >= MIN_SCORE)
        if (filtered.length > 0) {
          setResults(filtered)
        } else {
          const best = normalized.reduce((p, c) => ((p.score ?? 0) > (c.score ?? 0) ? p : c))
          setResults([best])
          setLowScore('일치율이 낮지만, 가장 유사한 결과를 보여드립니다.')
        }
      } else {
        setResults(data)
      }
    } catch (err) {
      const msg = (err as { message?: string })?.message
      setNoResult(msg ? `검색 중 오류가 발생했습니다. (${msg})` : '검색 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      {/* 모드 탭 (Radix) */}
      <Tabs value={mode} onValueChange={(v) => changeMode(v as SearchType)}>
        <TabsList className="h-12 w-full rounded-2xl bg-secondary/50 p-1.5">
          {TABS.map((t) => {
            const Icon = t.icon
            return (
              <TabsTrigger
                key={t.type}
                value={t.type}
                className="gap-2 rounded-xl text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm dark:data-[state=active]:bg-card"
              >
                <Icon />
                {t.label}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {/* Siri급 마이크 */}
      <div className="flex flex-col items-center gap-4">
        <MicButton recording={!!stream} disabled={!!stream} onClick={startRecording} />
        <motion.p
          key={recordedUrl ? 'again' : 'start'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-muted-foreground"
        >
          {recordedUrl ? '다시 녹음하려면 버튼을 누르세요' : '버튼을 눌러 녹음을 시작하세요'}
        </motion.p>
      </div>

      {/* 녹음 결과 재생 (녹음기 앱 스타일) + 검색 */}
      <AnimatePresence>
        {recordedUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <Card className="gap-5 p-5">
              <div ref={waveContainerRef} className="w-full" />

              <div className="flex items-center justify-between text-sm tabular-nums text-muted-foreground">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>

              <div className="flex items-center justify-center">
                <motion.button
                  type="button"
                  onClick={togglePlay}
                  whileTap={{ scale: 0.9 }}
                  className="flex size-16 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-md transition-colors hover:bg-secondary/80"
                  aria-label={isPlaying ? '일시정지' : '재생'}
                >
                  {isPlaying ? <Pause className="size-7" /> : <Play className="size-7 translate-x-0.5" />}
                </motion.button>
              </div>

              <Button
                type="button"
                onClick={doSearch}
                disabled={loading}
                size="lg"
                className="h-12 w-full text-base font-semibold shadow-lg shadow-brand/25 transition-transform active:scale-[0.98]"
              >
                <Search />
                {loading ? '검색 중…' : '검색'}
              </Button>

              {/* WaveSurfer(media)가 이 엘리먼트로 재생·커서를 제어한다 */}
              <audio ref={audioRef} preload="auto" className="hidden" />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 결과 (레이아웃 밀림을 부드럽게) */}
      <motion.div layout transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
        <SearchResultsList
          results={results}
          noResultMessage={noResult}
          lowScoreMessage={lowScore}
          searchType={mode}
          loading={loading}
        />
      </motion.div>

      {/* 녹음 모달 */}
      <AnimatePresence>
        {stream && <RecordingModal stream={stream} onSave={handleSave} onStop={handleStop} />}
      </AnimatePresence>
    </div>
  )
}
