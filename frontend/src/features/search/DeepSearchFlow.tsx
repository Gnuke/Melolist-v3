import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, Check, ExternalLink, Globe, Heart, Hourglass, Search } from 'lucide-react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CoverArt } from './CoverArt'
import { FailureView } from './FailureView'
import { deepQuota, deepSearch, selectDeepCandidate, type DeepQuota } from './api'
import { addRecentFind } from './recentFinds'
import { track } from '@/features/events/track'
import type { AcrResult } from './types'

const MIN_LEN = 2
const MAX_LEN = 200

/**
 * 웹검색 심층 탐색(spec 004) — AI 폴백의 에스컬레이션 티어. 로그인 사용자 전용이며
 * 진입 게이트(게스트 로그인 유도)는 FallbackSearchView가 담당한다.
 *
 * 흐름: confirm(질의 프리필·수정·잔여 횟수·소요 안내 — 실행 확정 전 한도 소모 없음)
 * → searching(진행·취소, 최대 35s) → candidates(미확인 배지 혼재)/empty/error/quota.
 * 후보 "선택"이 저장 시점(deep/select)이고 ♡는 선택 확정 후에만 동작한다(002와 동일).
 */
type Step =
  | { name: 'confirm' }
  | { name: 'searching' }
  | { name: 'candidates'; results: AcrResult[] }
  | { name: 'empty' }
  | { name: 'error' }
  | { name: 'quota'; resetAt: string | null }

interface Props {
  /** AI 폴백에서 마지막으로 검색한 질의 — 확인 단계에 프리필된다(FR-002) */
  initialQuery: string
  /** 부모(SearchPage)의 즐겨찾기 토글 — 선택 확정 후 호출된다 */
  onFavorite: (r: AcrResult, rank: number) => void
  savedAcrids: ReadonlySet<string>
  /** 진입 전 화면(AI 폴백 무결과/후보 목록)으로 복귀 — US2 AS-2 */
  onBack: () => void
}

function artistName(artists?: AcrResult['artists']) {
  const n = artists?.[0]?.name
  return n && n.trim().length > 0 ? n : '미상'
}

function resetTimeLabel(resetAt: string | null): string {
  if (!resetAt) return '내일'
  const d = new Date(resetAt)
  return Number.isNaN(d.getTime()) ? '내일' : `${d.getMonth() + 1}월 ${d.getDate()}일 0시`
}

export function DeepSearchFlow({ initialQuery, onFavorite, savedAcrids, onBack }: Props) {
  const [step, setStep] = useState<Step>({ name: 'confirm' })
  const [query, setQuery] = useState(initialQuery)
  const [quota, setQuota] = useState<DeepQuota | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set())
  const selectBusyRef = useRef<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)
  const startedAtRef = useRef(0)
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => () => abortRef.current?.abort(), [])

  const trimmed = query.trim()
  const canSearch = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN

  // 확인 단계 진입마다 잔여 횟수 갱신(FR-002) — 소진이면 실행 대신 안내로 수렴(US3 AS-1).
  // 조회 실패 시에는 표시만 생략한다(한도의 최종 방어선은 서버 429).
  useEffect(() => {
    if (step.name !== 'confirm') return
    let alive = true
    deepQuota()
      .then((q) => {
        if (!alive) return
        setQuota(q)
        if (q.remaining <= 0) setStep({ name: 'quota', resetAt: q.reset_at })
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [step.name])

  // 진행 경과 표시 — 30초급 대기의 심리적 안전장치
  useEffect(() => {
    if (step.name !== 'searching') return
    setElapsedSec(0)
    const timer = setInterval(
      () => setElapsedSec(Math.floor((performance.now() - startedAtRef.current) / 1000)),
      1_000,
    )
    return () => clearInterval(timer)
  }, [step.name])

  const runDeepSearch = useCallback(async () => {
    if (!canSearch) return
    const controller = new AbortController()
    abortRef.current = controller
    startedAtRef.current = performance.now()
    setStep({ name: 'searching' })
    try {
      const results = await deepSearch(trimmed, controller.signal)
      if (controller.signal.aborted) return
      if (results.length === 0) {
        setStep({ name: 'empty' })
      } else {
        setStep({ name: 'candidates', results: results.slice(0, 5) })
      }
    } catch (err) {
      if (isAxiosError(err) && err.code === 'ERR_CANCELED') return
      if (isAxiosError(err) && err.response?.status === 429) {
        const data = err.response.data as { details?: { reset_at?: string } } | undefined
        setStep({ name: 'quota', resetAt: data?.details?.reset_at ?? null })
        return
      }
      // 35s 하드컷(ECONNABORTED)·502 등 — raw 메시지는 렌더하지 않는다(F4 규칙)
      setStep({ name: 'error' })
    }
  }, [canSearch, trimmed])

  // 진행 중 취소 — 요청을 끊고 확인 단계로 복귀(한도는 서버 접수 시점에 이미 집계됨)
  const cancelSearch = useCallback(() => {
    abortRef.current?.abort()
    track('deep_search_cancel', { elapsed_ms: Math.round(performance.now() - startedAtRef.current) })
    setStep({ name: 'confirm' })
  }, [])

  /** 후보 선택 확정 — 저장 시점. 미확인 곡도 웹 근거 링크가 그대로 저장된다(FR-006). */
  const ensureSelected = useCallback(
    async (r: AcrResult, rank: number): Promise<boolean> => {
      const key = r.acrid
      if (!key) return false
      if (selectedKeys.has(key)) return true
      if (selectBusyRef.current.has(key)) return false
      selectBusyRef.current.add(key)
      try {
        await selectDeepCandidate(r, rank + 1) // 서버 rank는 1부터
        setSelectedKeys((prev) => new Set(prev).add(key))
        addRecentFind(r)
        return true
      } catch {
        toast('곡을 확정하지 못했어요 — 잠시 후 다시 시도해주세요')
        return false
      } finally {
        selectBusyRef.current.delete(key)
      }
    },
    [selectedKeys],
  )

  const onPick = useCallback(
    async (r: AcrResult, rank: number) => {
      const already = r.acrid ? selectedKeys.has(r.acrid) : false
      if (await ensureSelected(r, rank)) {
        if (!already) toast('이 곡으로 확인했어요')
      }
    },
    [ensureSelected, selectedKeys],
  )

  const onHeart = useCallback(
    async (r: AcrResult, rank: number) => {
      if (await ensureSelected(r, rank)) onFavorite(r, rank)
    },
    [ensureSelected, onFavorite],
  )

  return (
    <div className="flex flex-1 flex-col">
      {/* ── 확인 단계(FR-002) — 실행 확정 전에는 한도가 소모되지 않는다 ── */}
      {step.name === 'confirm' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-1 flex-col gap-4 pt-6"
        >
          <div>
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em]">
              웹까지 뒤져서
              <br />
              찾아볼게요
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              최신 곡·희귀한 곡은 웹 검색으로 확인해요
              <br />
              최대 30초 정도 걸릴 수 있어요
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, MAX_LEN))}
              rows={4}
              placeholder={'예) 이번 달에 나온 노래인데\n후렴에 ○○○이 반복돼요'}
              className="w-full resize-none rounded-2xl border border-input bg-card p-4 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">
                {quota ? `오늘 남은 횟수 ${quota.remaining}/${quota.limit}회` : ' '}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {trimmed.length}/{MAX_LEN}
              </span>
            </div>
          </div>
          <div className="mt-auto flex flex-col gap-2.5 pb-2">
            <Button
              type="button"
              onClick={() => void runDeepSearch()}
              disabled={!canSearch}
              size="lg"
              className="h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
            >
              <Globe /> 더 깊이 찾기
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              size="lg"
              className="h-11 w-full rounded-full text-sm font-semibold transition-transform active:scale-[0.97]"
            >
              돌아가기
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── 진행 중 — 웹검색 발동 시 20초 안팎이라 경과·취소를 상시 노출 ── */}
      {step.name === 'searching' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col gap-4 pt-6">
          <div>
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em]">웹에서 찾는 중…</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              발매 정보까지 확인하고 있어요 · <span className="tabular-nums">{elapsedSec}초</span>
            </p>
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
        </motion.div>
      )}

      {/* ── 후보 목록 — 미확인 후보도 제외하지 않고 배지로 구분(FR-005) ── */}
      {step.name === 'candidates' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col gap-4 pt-6">
          <div>
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em]">이 중에 있나요?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              곡을 누르면 찾은 곡으로 저장돼요 · 미확인 곡은 정보가 다를 수 있어요
            </p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {step.results.map((r, i) => {
              const selected = !!r.acrid && selectedKeys.has(r.acrid)
              const saved = !!r.acrid && savedAcrids.has(r.acrid)
              return (
                <li
                  key={r.acrid ?? i}
                  className={
                    selected
                      ? 'flex items-center gap-3.5 rounded-2xl border border-iris/40 bg-card p-3.5'
                      : 'flex items-center gap-3.5 rounded-2xl border border-border bg-card/60 p-3.5'
                  }
                >
                  <button
                    type="button"
                    onClick={() => void onPick(r, i)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                  >
                    <CoverArt coverUrl={r.cover_url} videoId={r.youtube_video_id} alt={r.title ?? ''} className="size-14" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold">{r.title ?? '-'}</span>
                      <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                        {artistName(r.artists)}
                        {r.album?.name ? ` · ${r.album.name}` : ''}
                      </span>
                      {(r.verified === false || selected) && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {r.verified === false && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                              <Globe className="size-3" /> 미확인 · 웹 검색 결과
                            </span>
                          )}
                          {selected && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-iris/15 px-2 py-0.5 text-xs font-bold text-iris-soft">
                              <Check className="size-3" /> 찾은 곡으로 저장됨
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                  <div className="flex flex-col items-center gap-1">
                    {r.youtube_url && (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full text-muted-foreground hover:text-foreground"
                      >
                        <a href={r.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube에서 듣기">
                          <ExternalLink />
                        </a>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => void onHeart(r, i)}
                      className={
                        saved
                          ? 'rounded-full text-brand transition-transform hover:text-brand active:scale-90'
                          : 'rounded-full text-muted-foreground transition-transform hover:text-brand active:scale-90'
                      }
                      aria-label={saved ? '즐겨찾기 해제' : '즐겨찾기'}
                      aria-pressed={saved}
                    >
                      <Heart className={saved ? 'fill-current' : undefined} />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          <div className="mt-auto flex flex-col gap-2.5 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep({ name: 'confirm' })}
              size="lg"
              className="h-11 w-full rounded-full text-sm font-semibold transition-transform active:scale-[0.97]"
            >
              <Search /> 다시 설명해서 찾기
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onBack}
              size="lg"
              className="h-11 w-full rounded-full text-sm font-semibold text-muted-foreground transition-transform hover:text-foreground active:scale-[0.97]"
            >
              이전 결과로 돌아가기
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── 무후보 — 오류가 아닌 안내, 재시도는 한도가 소모됨을 확인 단계가 보여준다 ── */}
      {step.name === 'empty' && (
        <FailureView
          icon={Search}
          tone="neutral"
          title="웹에서도 찾지 못했어요"
          body={'단서를 조금만 더 주세요.\n가사 한 소절, 발표 시기, 어디서\n들었는지가 큰 도움이 돼요'}
          actions={[
            { label: '다시 설명하기', onClick: () => setStep({ name: 'confirm' }), primary: true },
            { label: '돌아가기', onClick: onBack },
          ]}
        />
      )}

      {/* ── 오류(502·35s 타임아웃) — F4 패턴 ── */}
      {step.name === 'error' && (
        <FailureView
          icon={AlertCircle}
          tone="danger"
          title="심층 탐색이 잠시 원활하지 않아요"
          body={'입력한 설명은 그대로 있어요.\n잠시 후 다시 시도해주세요'}
          actions={[
            { label: '다시 시도', onClick: () => setStep({ name: 'confirm' }), primary: true },
            { label: '돌아가기', onClick: onBack },
          ]}
        />
      )}

      {/* ── 일일 한도 소진(사전 감지·429 공통, US3) — 일반 AI 폴백은 영향 없다 ── */}
      {step.name === 'quota' && (
        <FailureView
          icon={Hourglass}
          tone="warning"
          title="오늘의 심층 탐색을 모두 사용했어요"
          body={`${resetTimeLabel(step.resetAt)}에 다시 사용할 수 있어요.\nAI 검색과 녹음 검색은 계속 이용할 수 있어요`}
          actions={[{ label: '돌아가기', onClick: onBack, primary: true }]}
        />
      )}
    </div>
  )
}
