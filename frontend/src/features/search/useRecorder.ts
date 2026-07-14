import { useCallback, useEffect, useRef, useState } from 'react'

export interface Recording {
  blob: Blob
  durationMs: number
  /** 녹음 전체의 평균 RMS 레벨(0~1) — 무음 사전 검증(F1)용 */
  meanLevel: number
}

interface Options {
  /** 이 시간에 도달하면 자동 정지 (지문 12s / 허밍 20s) */
  maxMs: number
  onComplete: (rec: Recording) => void
  onError: (message: string) => void
}

export type RecorderPhase = 'idle' | 'acquiring' | 'recording' | 'paused'

function pickMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', 'audio/mp4']
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t
  }
  return undefined
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

/**
 * 녹음 엔진: getUserMedia + MediaRecorder + AnalyserNode.
 * - levelRef: rAF마다 갱신되는 실시간 RMS(0~1, 스무딩) — 링/파형이 직접 읽는다(리렌더 없음)
 * - startedAtRef: 녹음 시작 시각(performance.now) — 카운트다운 진행률 계산용
 * - maxMs 도달 시 자동 정지 → onComplete
 */
export function useRecorder({ maxMs, onComplete, onError }: Options) {
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [seconds, setSeconds] = useState(0)

  const levelRef = useRef(0)
  const startedAtRef = useRef(0)
  const analyserRef = useRef<AnalyserNode | null>(null)

  // 진행 중 녹음 1건의 리소스 (StrictMode/재시작 안전을 위해 세션 객체로 소유)
  const sessionRef = useRef<{
    stream: MediaStream
    ctx: AudioContext
    source: MediaStreamAudioSourceNode // GC 방지용 참조 소유 (아래 주석 참고)
    recorder: MediaRecorder
    chunks: BlobPart[]
    mimeType?: string
    raf: number
    timer: number
    autoStop: number
    levelSum: number
    levelCount: number
    /** 일시정지 시각(performance.now) — null이면 녹음 진행 중 */
    pausedAt: number | null
  } | null>(null)
  const acquiringRef = useRef(false)
  // 언마운트 후 getUserMedia가 늦게 resolve되면 스트림을 즉시 폐기하기 위한 플래그.
  // StrictMode 이중 마운트에서는 두 번째 start()가 플래그를 다시 내린다.
  const disposedRef = useRef(false)

  const disposeSession = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    sessionRef.current = null
    cancelAnimationFrame(s.raf)
    window.clearInterval(s.timer)
    window.clearTimeout(s.autoStop)
    if (s.recorder.state !== 'inactive') {
      s.recorder.onstop = null
      try {
        s.recorder.stop()
      } catch {
        // ignore
      }
    }
    try {
      s.source.disconnect()
    } catch {
      // ignore
    }
    void s.ctx.close().catch(() => undefined)
    s.stream.getTracks().forEach((t) => t.stop())
    analyserRef.current = null
    levelRef.current = 0
  }, [])

  const stop = useCallback(() => {
    const s = sessionRef.current
    if (!s) return
    sessionRef.current = null
    cancelAnimationFrame(s.raf)
    window.clearInterval(s.timer)
    window.clearTimeout(s.autoStop)

    // 일시정지 상태에서 종료되면 정지 시각까지만 녹음 시간으로 친다
    const durationMs = (s.pausedAt ?? performance.now()) - startedAtRef.current
    const meanLevel = s.levelCount > 0 ? s.levelSum / s.levelCount : 0

    const finalize = () => {
      const blob = new Blob(s.chunks, { type: s.recorder.mimeType || s.mimeType || 'audio/webm' })
      try {
        s.source.disconnect()
      } catch {
        // ignore
      }
      void s.ctx.close().catch(() => undefined)
      s.stream.getTracks().forEach((t) => t.stop())
      analyserRef.current = null
      levelRef.current = 0
      setPhase('idle')
      onComplete({ blob, durationMs, meanLevel })
    }

    if (s.recorder.state !== 'inactive') {
      s.recorder.onstop = finalize
      s.recorder.stop()
    } else {
      finalize()
    }
  }, [onComplete])
  const stopRef = useRef(stop)
  stopRef.current = stop

  const cancel = useCallback(() => {
    disposeSession()
    setPhase('idle')
    setSeconds(0)
  }, [disposeSession])

  /**
   * 녹음 일시정지 — 취소 확인 시트가 뜨는 동안 데이터 수집·자동정지·경과시간을 멈춘다.
   * 마이크 스트림은 유지되므로 resume()으로 끊김 없이 이어진다.
   */
  const pause = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.pausedAt !== null) return
    s.pausedAt = performance.now()
    window.clearTimeout(s.autoStop)
    window.clearInterval(s.timer)
    if (s.recorder.state === 'recording') {
      try {
        s.recorder.pause()
      } catch {
        // ignore
      }
    }
    setPhase('paused')
  }, [])

  const resume = useCallback(() => {
    const s = sessionRef.current
    if (!s || s.pausedAt === null) return
    // 시작 시각을 정지 시간만큼 뒤로 밀어 경과·진행률·durationMs에서 정지 구간을 제외
    startedAtRef.current += performance.now() - s.pausedAt
    s.pausedAt = null
    if (s.recorder.state === 'paused') {
      try {
        s.recorder.resume()
      } catch {
        // ignore
      }
    }
    s.timer = window.setInterval(() => {
      setSeconds(Math.floor((performance.now() - startedAtRef.current) / 1000))
    }, 250)
    const remaining = Math.max(0, maxMs - (performance.now() - startedAtRef.current))
    s.autoStop = window.setTimeout(() => stopRef.current(), remaining)
    setPhase('recording')
  }, [maxMs])

  /** 녹음 경과(ms) — 일시정지 중에는 정지 시점 값으로 고정된다 (링 진행률용). */
  const getElapsedMs = useCallback(() => {
    const s = sessionRef.current
    if (!s) return 0
    return (s.pausedAt ?? performance.now()) - startedAtRef.current
  }, [])

  const start = useCallback(async () => {
    disposedRef.current = false
    if (sessionRef.current || acquiringRef.current) return
    if (!navigator?.mediaDevices?.getUserMedia) {
      onError('이 브라우저에서는 녹음을 지원하지 않습니다.')
      return
    }
    acquiringRef.current = true
    setPhase('acquiring')
    let stream: MediaStream
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      if (!devices.some((d) => d.kind === 'audioinput')) {
        throw Object.assign(new Error('no audio input'), { name: 'NotFoundError' })
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      acquiringRef.current = false
      setPhase('idle')
      onError(mapMicError(err))
      return
    }
    acquiringRef.current = false
    if (disposedRef.current) {
      stream.getTracks().forEach((t) => t.stop())
      setPhase('idle')
      return
    }

    const ctx = new AudioContext()
    void ctx.resume().catch(() => undefined) // autoplay 정책으로 suspended면 재개
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    // ⚠️ source는 반드시 세션이 참조로 소유해야 한다 — 참조 없는 MediaStreamAudioSourceNode는
    // Chrome이 GC로 수거해 analyser가 무음만 읽게 됨(재녹음마다 F1 오탐지 원인)
    const source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
    analyserRef.current = analyser

    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    const chunks: BlobPart[] = []
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.start(200) // 200ms 단위 수집 — 정지 시점 유실 방지

    startedAtRef.current = performance.now()
    setSeconds(0)

    const session = {
      stream,
      ctx,
      source,
      recorder,
      chunks,
      mimeType,
      raf: 0,
      timer: 0,
      autoStop: 0,
      levelSum: 0,
      levelCount: 0,
      pausedAt: null as number | null,
    }
    sessionRef.current = session

    // 실시간 RMS: 링/파형은 levelRef를 자체 rAF로 읽는다 (React 리렌더 0)
    const buffer = new Uint8Array(analyser.fftSize)
    const measure = () => {
      if (sessionRef.current !== session) return
      session.raf = requestAnimationFrame(measure)
      if (session.pausedAt !== null) {
        // 일시정지 중 — 시각 레벨만 감쇠시키고 평균(무음 검증 분모)에는 넣지 않는다
        levelRef.current *= 0.9
        return
      }
      analyser.getByteTimeDomainData(buffer)
      let sum = 0
      for (let i = 0; i < buffer.length; i++) {
        const v = ((buffer[i] ?? 128) - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / buffer.length)
      levelRef.current = levelRef.current * 0.7 + rms * 0.3
      session.levelSum += rms
      session.levelCount += 1
    }
    measure()

    session.timer = window.setInterval(() => {
      setSeconds(Math.floor((performance.now() - startedAtRef.current) / 1000))
    }, 250)
    session.autoStop = window.setTimeout(() => stopRef.current(), maxMs)

    setPhase('recording')
  }, [maxMs, onError])

  // 언마운트 시 진행 중 녹음 폐기 (StrictMode 이중 마운트 포함)
  useEffect(
    () => () => {
      disposedRef.current = true
      disposeSession()
    },
    [disposeSession],
  )

  return { phase, seconds, start, stop, cancel, pause, resume, getElapsedMs, levelRef, startedAtRef, analyserRef }
}
