import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, AudioLines, ChevronLeft, Mic, MicOff, Search, SearchX, Square } from 'lucide-react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/authStore'
import { track } from '@/features/events/track'
import { useRecorder, type Recording } from '@/features/search/useRecorder'
import { RecognitionRing } from '@/features/search/RecognitionRing'
import { LiveWaveform } from '@/features/search/LiveWaveform'
import { PlaybackCard } from '@/features/search/PlaybackCard'
import { ResultsView } from '@/features/search/ResultsView'
import { FailureView } from '@/features/search/FailureView'
import { FavoriteSheet } from '@/features/search/FavoriteSheet'
import { addRecentFind } from '@/features/search/recentFinds'
import { clearStashedResults, peekStashedResults, stashResults } from '@/features/search/resultStash'
import { hasPendingLoginReturn } from '@/features/events/loginEvents'
import { recognize } from '@/features/search/api'
import type { AcrResult, SearchType } from '@/features/search/types'

const MIN_SCORE = 50 // 허밍 저신뢰(F3) 기준: score*100 < 50
const SILENCE_RMS = 0.01 // 평균 RMS가 이보다 낮으면 무음(F1) — 업로드하지 않는다

const LIMITS: Record<SearchType, { maxMs: number; minMs: number }> = {
  fingerprint: { maxMs: 12_000, minMs: 3_000 }, // D1: 12초 자동 종료 + 즉시 자동 검색
  humming: { maxMs: 20_000, minMs: 8_000 }, // D2: 수동 정지, 20초 컷, 8초 미만 F1
}

type Phase =
  | { name: 'recording' }
  | { name: 'confirm'; rec: Recording } // 허밍 전용 — 확인 후 수동 검색
  | { name: 'searching' }
  | { name: 'results'; results: AcrResult[]; lowScore: boolean; restored?: boolean }
  | { name: 'failure'; kind: 'F1'; variant: 'silent' | 'short' }
  | { name: 'failure'; kind: 'F2' }
  | { name: 'failure'; kind: 'F4' }
  | { name: 'failure'; kind: 'MIC'; message: string }

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60)
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
}

export function SearchPage() {
  const { mode } = useParams()
  if (mode !== 'fingerprint' && mode !== 'humming') {
    return <Navigate to="/" replace />
  }
  // 모드 전환(F2의 "허밍으로 시도" 등) 시 상태 전체를 리셋한다
  return <SearchFlow key={mode} mode={mode} />
}

function SearchFlow({ mode }: { mode: SearchType }) {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const { maxMs, minMs } = LIMITS[mode]

  // FR-004: ♡ 로그인 유도 → OAuth 복귀 시 리다이렉트로 소실된 결과 화면을 복원한다.
  // 플래그(pending)는 LoginReturnGate가 effect에서 소거하므로 렌더 시점엔 아직 살아 있다.
  const [phase, setPhase] = useState<Phase>(() => {
    const stashed = hasPendingLoginReturn() ? peekStashedResults(mode) : null
    return stashed
      ? { name: 'results', results: stashed.results, lowScore: stashed.lowScore, restored: true }
      : { name: 'recording' }
  })
  const [sheetOpen, setSheetOpen] = useState(false)

  const lastRecRef = useRef<Recording | null>(null) // F4 재시도·재검색용 blob 보존
  const searchStartedAtRef = useRef(0) // client_ms 측정 시작점
  const abortRef = useRef<AbortController | null>(null) // 검색 중 취소·언마운트 시 요청 중단

  const runSearch = useCallback(
    async (rec: Recording) => {
      const controller = new AbortController()
      abortRef.current = controller
      setPhase({ name: 'searching' })
      searchStartedAtRef.current = performance.now()
      try {
        const results = await recognize(mode, rec.blob, controller.signal)
        if (controller.signal.aborted) return // 취소가 응답과 경합한 경우 — 취소 쪽이 이긴다
        if (results.length === 0) {
          // F2 무결과 — no_match 이벤트는 서버가 직접 기록(중복 발화 금지)
          setPhase({ name: 'failure', kind: 'F2' })
          return
        }
        if (mode === 'humming') {
          const normalized = results.map((r) => ({ ...r, score: typeof r.score === 'number' ? r.score : 0 }))
          const confident = normalized.filter((r) => (r.score ?? 0) * 100 >= MIN_SCORE)
          if (confident.length > 0) {
            setPhase({ name: 'results', results: confident.slice(0, 3), lowScore: false })
          } else {
            // F3 저신뢰 — 최고 1건만
            const best = normalized.reduce((p, c) => ((p.score ?? 0) > (c.score ?? 0) ? p : c))
            track('search_failed', { mode, reason: 'low_score' })
            setPhase({ name: 'results', results: [best], lowScore: true })
          }
        } else {
          setPhase({ name: 'results', results: results.slice(0, 3), lowScore: false })
        }
      } catch (err) {
        // 사용자 취소(AbortController) — cancelSearch가 화면 전환·계측을 이미 처리했다
        if (isAxiosError(err) && err.code === 'ERR_CANCELED') return
        // F4 — raw 에러 메시지는 화면에 노출하지 않는다(C4). 15초 타임아웃은 timeout으로 구분(KR2 진단용)
        const timedOut = isAxiosError(err) && err.code === 'ECONNABORTED'
        const httpStatus = isAxiosError(err) ? err.response?.status : undefined
        track('search_failed', { mode, reason: timedOut ? 'timeout' : 'error', http_status: httpStatus ?? null })
        setPhase({ name: 'failure', kind: 'F4' })
      }
    },
    [mode],
  )

  const handleRecorded = useCallback(
    (rec: Recording) => {
      // C7 업로드 전 사전 검증 — F1은 서버 왕복 없이 차단
      if (rec.durationMs < minMs) {
        track('search_failed', { mode, reason: 'bad_audio' })
        setPhase({ name: 'failure', kind: 'F1', variant: 'short' })
        return
      }
      if (rec.meanLevel < SILENCE_RMS) {
        track('search_failed', { mode, reason: 'bad_audio' })
        setPhase({ name: 'failure', kind: 'F1', variant: 'silent' })
        return
      }
      lastRecRef.current = rec
      if (mode === 'fingerprint') {
        void runSearch(rec) // D1: 정지 즉시 자동 검색 (Shazam 패턴)
      } else {
        setPhase({ name: 'confirm', rec }) // D2: 확인 카드 → 수동 검색
      }
    },
    [mode, minMs, runSearch],
  )

  const recorder = useRecorder({
    maxMs,
    onComplete: handleRecorded,
    onError: (message) => setPhase({ name: 'failure', kind: 'MIC', message }),
  })

  // 화면 진입 즉시 녹음 시작 (권한 ~2s는 30초 예산에 포함) — 복원 진입이면 결과를 보여주므로 녹음하지 않는다
  const startRef = useRef(recorder.start)
  startRef.current = recorder.start
  const restoredRef = useRef(phase.name === 'results')
  useEffect(() => {
    clearStashedResults() // 스태시는 1회용 — 다음 검색 진입은 새 녹음으로
    if (!restoredRef.current) void startRef.current()
  }, [])

  // C5: search_started = 녹음 시작 시점
  const prevRecPhase = useRef(recorder.phase)
  useEffect(() => {
    if (recorder.phase === 'recording' && prevRecPhase.current !== 'recording') {
      track('search_started', { mode })
    }
    prevRecPhase.current = recorder.phase
  }, [recorder.phase, mode])

  // C5: search_result_shown = 결과 렌더 완료 (+ 홈 선반용 최근 기록)
  // 복원 진입(restored)은 이미 발화·기록된 결과라 다시 계측하지 않는다
  useEffect(() => {
    if (phase.name !== 'results' || phase.restored) return
    const top = phase.results[0]
    track('search_result_shown', {
      mode,
      result_count: phase.results.length,
      top_score: typeof top?.score === 'number' ? top.score : null,
      client_ms: Math.round(performance.now() - searchStartedAtRef.current),
    })
    if (!phase.lowScore && top) addRecentFind(top)
  }, [phase, mode])

  // 허밍 확인 카드의 재생 URL 수명 관리
  const [confirmUrl, setConfirmUrl] = useState<string | null>(null)
  useEffect(() => {
    if (phase.name !== 'confirm') return
    const url = URL.createObjectURL(phase.rec.blob)
    setConfirmUrl(url)
    return () => {
      URL.revokeObjectURL(url)
      setConfirmUrl(null)
    }
  }, [phase])

  const reRecord = useCallback(() => {
    setPhase({ name: 'recording' })
    void startRef.current()
  }, [])

  const retrySame = useCallback(() => {
    const rec = lastRecRef.current
    if (rec) void runSearch(rec)
    else reRecord()
  }, [runSearch, reRecord])

  // 검색 중 사용자 취소 — 요청을 끊고 녹음 화면으로 (오래 걸릴 때의 탈출구)
  const cancelSearch = useCallback(() => {
    abortRef.current?.abort()
    track('search_failed', { mode, reason: 'cancelled' })
    reRecord()
  }, [mode, reRecord])

  // 화면 이탈 시 진행 중 요청 정리 (이탈 후 도착할 응답은 버려진다)
  useEffect(() => () => abortRef.current?.abort(), [])

  const onFavorite = useCallback(
    (_r: AcrResult) => {
      track('favorite_click', { mode, authed: !!session }) // C6: 게스트→가입 전환 원천
      if (session) {
        // 저장 동작은 M3 — 버튼만 선노출(D4)
        toast('즐겨찾기 저장은 곧 열려요 — 준비 중이에요')
      } else {
        setSheetOpen(true)
      }
    },
    [mode, session],
  )

  const isRecordingScreen = phase.name === 'recording'
  const elapsed = Math.min(recorder.seconds, Math.floor(maxMs / 1000))

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-8 pt-4">
      {/* 상단 바 */}
      <header className="mb-2 flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="-ml-2 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft /> {isRecordingScreen || phase.name === 'confirm' ? '취소' : '홈'}
        </Button>
      </header>

      <AnimatePresence mode="wait">
        {/* ── 녹음 중 ── */}
        {isRecordingScreen && (
          <motion.section
            key="recording"
            className="flex flex-1 flex-col items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex flex-1 flex-col items-center justify-center gap-7">
              {mode === 'fingerprint' ? (
                <RecognitionRing
                  levelRef={recorder.levelRef}
                  getProgress={() =>
                    recorder.phase === 'recording'
                      ? Math.min(1, (performance.now() - recorder.startedAtRef.current) / maxMs)
                      : 0
                  }
                  active={recorder.phase === 'recording'}
                >
                  <Mic className="size-7 text-iris-soft" />
                  <span className="text-[15px] font-extrabold tabular-nums tracking-tight">
                    {formatElapsed(elapsed)}
                  </span>
                </RecognitionRing>
              ) : (
                <div className="flex flex-col items-center gap-6">
                  <div
                    className="flex size-32 flex-col items-center justify-center gap-1 rounded-full border border-white/10"
                    style={{
                      background: 'linear-gradient(165deg, var(--ink-800), var(--ink-900))',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 16px 48px rgba(0,0,0,0.55)',
                    }}
                  >
                    <AudioLines className="size-7 text-iris-soft" />
                    <span className="text-[15px] font-extrabold tabular-nums tracking-tight">
                      {formatElapsed(elapsed)}
                      <span className="font-medium text-muted-foreground"> / 0:20</span>
                    </span>
                  </div>
                  <LiveWaveform analyserRef={recorder.analyserRef} active={recorder.phase === 'recording'} />
                </div>
              )}

              <div className="flex flex-col items-center gap-1.5 text-center">
                {mode === 'humming' && recorder.phase === 'recording' && (
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <motion.span
                      className="size-2 rounded-full bg-destructive"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                    녹음 중
                  </span>
                )}
                <p className="text-[17px] font-extrabold tracking-tight">
                  {recorder.phase !== 'recording'
                    ? '마이크 준비 중…'
                    : mode === 'fingerprint'
                      ? '듣고 있어요…'
                      : '불러주세요 — 후렴구가 좋아요'}
                </p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {mode === 'fingerprint'
                    ? '12초 뒤 자동으로 찾아드려요'
                    : '최대 20초 · 8초 이상 불러야 잘 찾아요'}
                </p>
              </div>
            </div>

            <div className="pb-6">
              {mode === 'fingerprint' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={recorder.stop}
                  disabled={recorder.phase !== 'recording'}
                  size="lg"
                  className="h-12 rounded-full px-7 text-sm font-bold transition-transform active:scale-[0.97]"
                >
                  <Square className="fill-current" /> 지금 멈추고 검색
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={recorder.stop}
                  disabled={recorder.phase !== 'recording'}
                  size="lg"
                  className="h-12 rounded-full px-10 text-sm font-bold transition-transform active:scale-[0.97]"
                >
                  <Square className="fill-current" /> 정지
                </Button>
              )}
            </div>
          </motion.section>
        )}

        {/* ── 허밍: 녹음 확인 ── */}
        {phase.name === 'confirm' && (
          <motion.section
            key="confirm"
            className="flex flex-1 flex-col gap-4 pt-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em]">
              이 녹음으로
              <br />
              찾을까요?
            </h2>
            {confirmUrl && <PlaybackCard url={confirmUrl} />}
            <div className="mt-auto flex flex-col gap-2.5 pb-2">
              <Button
                type="button"
                onClick={() => {
                  if (phase.name === 'confirm') void runSearch(phase.rec)
                }}
                size="lg"
                className="h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
              >
                <Search /> 이 녹음으로 검색
              </Button>
              <Button
                type="button"
                onClick={reRecord}
                variant="outline"
                size="lg"
                className="h-12 w-full rounded-full text-[15px] font-semibold transition-transform active:scale-[0.97]"
              >
                다시 녹음
              </Button>
            </div>
          </motion.section>
        )}

        {/* ── 검색 중 (스켈레톤에 이미지 자리 포함 — C2) ── */}
        {phase.name === 'searching' && (
          <motion.section
            key="searching"
            className="flex flex-1 flex-col gap-4 pt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div>
              <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em]">찾는 중…</h2>
              <p className="mt-1 text-sm text-muted-foreground">멜로디를 대조하고 있어요</p>
            </div>
            <div className="flex flex-col gap-2.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-white/7 bg-card/60 p-3.5">
                  <Skeleton className="size-14 shrink-0 rounded-[10px]" />
                  <div className="flex w-full flex-col gap-2">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
            {/* 오래 걸릴 때의 탈출구 — 요청을 끊고 다시 녹음으로 */}
            <div className="mt-auto flex justify-center pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={cancelSearch}
                size="lg"
                className="h-12 rounded-full px-7 text-sm font-bold transition-transform active:scale-[0.97]"
              >
                취소
              </Button>
            </div>
          </motion.section>
        )}

        {/* ── 결과 ── */}
        {phase.name === 'results' && (
          <motion.section
            key="results"
            className="flex flex-1 flex-col pt-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ResultsView
              mode={mode}
              results={phase.results}
              lowScore={phase.lowScore}
              onFavorite={onFavorite}
              onRetrySame={retrySame}
              onReRecord={reRecord}
            />
          </motion.section>
        )}

        {/* ── 실패 (F1·F2·F4·마이크) ── */}
        {phase.name === 'failure' && (
          <motion.section key={`failure-${phase.kind}`} className="flex flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {phase.kind === 'F1' && (
              <FailureView
                icon={MicOff}
                tone="warning"
                title={phase.variant === 'silent' ? '소리가 거의 녹음되지 않았어요' : mode === 'humming' ? '조금 더 길게 불러주세요' : '녹음이 너무 짧았어요'}
                body={
                  phase.variant === 'silent'
                    ? '마이크를 가까이 하고 다시 시도해주세요'
                    : mode === 'humming'
                      ? '8초 이상 불러야 멜로디를 알아들을 수 있어요'
                      : '3초 이상 들려주세요'
                }
                actions={[{ label: '다시 녹음', onClick: reRecord, primary: true }]}
              />
            )}
            {phase.kind === 'F2' && (
              <FailureView
                icon={SearchX}
                tone="neutral"
                title="일치하는 곡을 찾지 못했어요"
                body={
                  mode === 'fingerprint'
                    ? '주변 소리가 섞였을 수 있어요.\n이번엔 직접 불러보시겠어요?'
                    : '후렴구를 10초 이상 불러주면 더 잘 찾아요'
                }
                actions={
                  mode === 'fingerprint'
                    ? [
                        { label: '허밍으로 시도', onClick: () => navigate('/search/humming'), primary: true },
                        { label: '다시 녹음', onClick: reRecord },
                      ]
                    : [{ label: '다시 녹음', onClick: reRecord, primary: true }]
                }
              />
            )}
            {phase.kind === 'F4' && (
              <FailureView
                icon={AlertCircle}
                tone="danger"
                title="일시적인 문제가 발생했어요"
                body={'녹음은 그대로 있어요.\n잠시 후 다시 시도해주세요'}
                actions={[
                  { label: '재시도', onClick: retrySame, primary: true }, // 보존한 blob 재전송 — 재녹음 불필요
                  { label: '다시 녹음', onClick: reRecord },
                ]}
              />
            )}
            {phase.kind === 'MIC' && (
              <FailureView
                icon={MicOff}
                tone="danger"
                title="마이크를 사용할 수 없어요"
                body={phase.message}
                actions={[{ label: '다시 시도', onClick: reRecord, primary: true }]}
              />
            )}
          </motion.section>
        )}
      </AnimatePresence>

      <FavoriteSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onLogin={() => {
          // FR-004: OAuth 리다이렉트로 소실될 결과를 보관 — 복귀 시 이 화면 그대로 복원
          if (phase.name === 'results') stashResults(mode, phase.results, phase.lowScore)
          navigate('/login', { state: { next: `/search/${mode}` } })
        }}
      />
    </div>
  )
}
