import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { FallbackSearchView } from '@/features/search/FallbackSearchView'
import { FavoriteSheet } from '@/features/search/FavoriteSheet'
import { QuitConfirmSheet } from '@/features/search/QuitConfirmSheet'
import { addRecentFind } from '@/features/search/recentFinds'
import { clearStashedResults, peekStashedResults, stashResults } from '@/features/search/resultStash'
import { hasPendingLoginReturn } from '@/features/events/loginEvents'
import { recognize } from '@/features/search/api'
import { addFavorite, removeFavorite } from '@/features/favorites/api'
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
  // spec 002 AI 자연어 폴백 — back은 오매칭(mismatch) 진입 시 복귀할 원래 결과
  | { name: 'fallback'; from: 'no_match' | 'mismatch'; back: { results: AcrResult[]; lowScore: boolean } | null }

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
  // 취소 확인 시트 — 어느 단계의 취소인지 (녹음 중=일시정지 후 확인 / 검색 중=요청 유지한 채 확인)
  const [quitSheet, setQuitSheet] = useState<null | 'recording' | 'searching'>(null)

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
  // useCallback 의존성용 — 훅이 반환하는 함수들은 참조가 안정적이다
  const { pause: pauseRecorder, resume: resumeRecorder, cancel: cancelRecorder } = recorder

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

  // spec 002: AI 폴백 진입(미매칭 F2 / 오매칭 결과 화면) — 진입 계측은 클라 책임(FR-009)
  const openFallback = useCallback((from: 'no_match' | 'mismatch', back: { results: AcrResult[]; lowScore: boolean } | null) => {
    track('ai_fallback_open', { from })
    setPhase({ name: 'fallback', from, back })
  }, [])

  // 폴백에서 뒤로 — 오매칭 진입이면 원래 결과 복원(US2 AS-2), 미매칭 진입이면 F2로
  const closeFallback = useCallback(() => {
    setPhase((p) => {
      if (p.name !== 'fallback') return p
      return p.back
        ? { name: 'results', results: p.back.results, lowScore: p.back.lowScore, restored: true }
        : { name: 'failure', kind: 'F2' }
    })
  }, [])

  // 취소 확정 공통 — 이 검색 시도를 접고 홈(검색 시작 화면)으로 나간다
  const quitToHome = useCallback(() => {
    setQuitSheet(null)
    track('search_failed', { mode, reason: 'cancelled' })
    navigate('/')
  }, [mode, navigate])

  // 녹음 중 취소: 녹음을 일시정지해 두고 의사를 묻는다 — 계속하면 이어서 녹음
  const askQuitRecording = useCallback(() => {
    pauseRecorder()
    setQuitSheet('recording')
  }, [pauseRecorder])

  const continueFromSheet = useCallback(() => {
    setQuitSheet(null)
    if (quitSheet === 'recording') resumeRecorder()
    // 'searching'은 요청을 끊지 않았으므로 닫기만 하면 대기가 이어진다
  }, [quitSheet, resumeRecorder])

  const confirmQuit = useCallback(() => {
    if (quitSheet === 'recording') {
      cancelRecorder() // onComplete 없이 폐기 — 검색으로 넘어가지 않는다
    } else {
      abortRef.current?.abort()
    }
    quitToHome()
  }, [quitSheet, cancelRecorder, quitToHome])

  // 확인 시트가 떠 있는 동안 검색이 끝나면(결과/실패 도착) 시트를 접는다 — 기다림이 끝났으므로
  useEffect(() => {
    if (quitSheet === 'searching' && phase.name !== 'searching') setQuitSheet(null)
  }, [quitSheet, phase.name])

  // 화면 이탈 시 진행 중 요청 정리 (이탈 후 도착할 응답은 버려진다)
  useEffect(() => () => abortRef.current?.abort(), [])

  // 이번 화면에서 저장한 곡: acrid → musicId (해제 DELETE에 musicId가 필요하다).
  // acrid가 키라서 같은 곡을 재검색해도 토글 상태가 이어진다.
  const [savedByAcrid, setSavedByAcrid] = useState<Record<string, number>>({})
  const savedAcridSet = useMemo(() => new Set(Object.keys(savedByAcrid)), [savedByAcrid])
  const favBusyRef = useRef<Set<string>>(new Set()) // 곡별 요청 in-flight 가드 (연타 방지)

  const onFavorite = useCallback(
    async (r: AcrResult, rank: number) => {
      const acrid = r.acrid
      const savedMusicId = acrid ? savedByAcrid[acrid] : undefined
      // C6: 게스트→가입 전환 + 매칭률 실측 원천 — 어느 순위·점수의 곡을 "내 곡"으로 집었는지
      track('favorite_click', {
        mode,
        authed: !!session,
        acrid: acrid ?? null,
        rank,
        score: typeof r.score === 'number' ? r.score : null,
        action: session ? (savedMusicId ? 'remove' : 'add') : 'login_prompt',
      })
      if (!session) {
        setSheetOpen(true)
        return
      }
      if (!acrid || favBusyRef.current.has(acrid)) return
      favBusyRef.current.add(acrid)
      try {
        if (savedMusicId) {
          await removeFavorite(savedMusicId)
          setSavedByAcrid((m) => {
            const next = { ...m }
            delete next[acrid]
            return next
          })
          toast('즐겨찾기에서 뺐어요')
        } else {
          const fav = await addFavorite(acrid)
          setSavedByAcrid((m) => ({ ...m, [acrid]: fav.music.id }))
          toast('즐겨찾기에 저장했어요')
        }
      } catch {
        toast('저장하지 못했어요 — 잠시 후 다시 시도해주세요')
      } finally {
        favBusyRef.current.delete(acrid)
      }
    },
    [mode, session, savedByAcrid],
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
          // 녹음 중=일시정지+확인 시트 / 폴백=진입 전 화면 복귀 / 그 외=홈
          onClick={isRecordingScreen ? askQuitRecording : phase.name === 'fallback' ? closeFallback : () => navigate('/')}
          className="-ml-2 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft />{' '}
          {isRecordingScreen || phase.name === 'confirm' ? '취소' : phase.name === 'fallback' ? '뒤로' : '홈'}
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
                  // 일시정지 중에는 getElapsedMs가 정지 시점 값으로 고정된다 (링 프리즈)
                  getProgress={() => Math.min(1, recorder.getElapsedMs() / maxMs)}
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
                    className="flex size-32 flex-col items-center justify-center gap-1 rounded-full border border-input"
                    style={{
                      background: 'linear-gradient(165deg, var(--popover), var(--muted))',
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
                  {recorder.phase === 'paused'
                    ? '잠시 멈췄어요'
                    : recorder.phase !== 'recording'
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
                <div key={i} className="flex items-center gap-3.5 rounded-2xl border border-border bg-card/60 p-3.5">
                  <Skeleton className="size-14 shrink-0 rounded-[10px]" />
                  <div className="flex w-full flex-col gap-2">
                    <Skeleton className="h-4 w-3/5" />
                    <Skeleton className="h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
            {/* 오래 걸릴 때의 탈출구 — 요청은 유지한 채 확인 시트로 의사를 먼저 묻는다 */}
            <div className="mt-auto flex justify-center pb-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuitSheet('searching')}
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
              savedAcrids={savedAcridSet}
              onRetrySame={retrySame}
              onReRecord={reRecord}
              onFallback={() => openFallback('mismatch', { results: phase.results, lowScore: phase.lowScore })}
            />
          </motion.section>
        )}

        {/* ── AI 자연어 폴백 (spec 002) ── */}
        {phase.name === 'fallback' && (
          <motion.section
            key="fallback"
            className="flex flex-1 flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <FallbackSearchView onFavorite={onFavorite} savedAcrids={savedAcridSet} onBack={closeFallback} />
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
                        { label: '말로 설명해서 찾기', onClick: () => openFallback('no_match', null) },
                        { label: '다시 녹음', onClick: reRecord },
                      ]
                    : [
                        // 허밍 미매칭 = 폴백의 핵심 진입점(spec 002 US1) — ACR 허밍 커버리지 한계의 구제 경로
                        { label: '말로 설명해서 찾기', onClick: () => openFallback('no_match', null), primary: true },
                        { label: '다시 녹음', onClick: reRecord },
                      ]
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

      <QuitConfirmSheet
        open={quitSheet !== null}
        icon={quitSheet === 'searching' ? Search : Mic}
        title={quitSheet === 'searching' ? '검색을 그만둘까요?' : '녹음을 그만둘까요?'}
        body={
          quitSheet === 'searching'
            ? '조금만 기다리면 결과가 나올 수 있어요'
            : '그만두면 지금까지 녹음한 내용은 사라져요'
        }
        continueLabel={quitSheet === 'searching' ? '계속 기다리기' : '계속 녹음하기'}
        quitLabel="그만두기"
        onContinue={continueFromSheet}
        onQuit={confirmQuit}
      />
    </div>
  )
}
