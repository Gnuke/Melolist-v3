import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AlertCircle, Check, ExternalLink, Heart, Hourglass, Search, Sparkles } from 'lucide-react'
import { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CoverArt } from './CoverArt'
import { FailureView } from './FailureView'
import { selectCandidate, textSearch } from './api'
import { addRecentFind } from './recentFinds'
import { track } from '@/features/events/track'
import type { AcrResult } from './types'

const MIN_LEN = 2
const MAX_LEN = 200

/**
 * AI 자연어 폴백 검색(spec 002) — 허밍/지문 실패·오매칭 경로에서만 진입한다.
 * 입력→검색→후보/무후보/오류/한도 상태를 내부에서 관리하고, 후보 "선택"이
 * 유일한 저장 시점(select API)이다. ♡는 선택 확정 후에만 동작한다(곡 row 선행 필요).
 */
type Step =
  | { name: 'input' }
  | { name: 'searching' }
  | { name: 'candidates'; results: AcrResult[] }
  | { name: 'empty' }
  | { name: 'error' }
  | { name: 'quota'; resetAt: string | null }

interface Props {
  /** 부모(SearchPage)의 즐겨찾기 토글 — 게스트 로그인 유도 포함. 선택 확정 후 호출된다 */
  onFavorite: (r: AcrResult, rank: number) => void
  savedAcrids: ReadonlySet<string>
  /** 진입 전 화면(원래 결과/실패)으로 복귀 */
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

export function FallbackSearchView({ onFavorite, savedAcrids, onBack }: Props) {
  const [step, setStep] = useState<Step>({ name: 'input' })
  const [query, setQuery] = useState('')
  // 선택 확정된 후보(ai-key) — 재선택 방지 + 체크 표시
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(new Set())
  const selectBusyRef = useRef<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)
  const startedAtRef = useRef(0)

  useEffect(() => () => abortRef.current?.abort(), [])

  const trimmed = query.trim()
  const canSearch = trimmed.length >= MIN_LEN && trimmed.length <= MAX_LEN

  const runTextSearch = useCallback(async () => {
    if (!canSearch) return
    const controller = new AbortController()
    abortRef.current = controller
    startedAtRef.current = performance.now()
    setStep({ name: 'searching' })
    try {
      const results = await textSearch(trimmed, controller.signal)
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
      // 15s 타임아웃(ECONNABORTED)·502 등 — raw 메시지는 렌더하지 않는다(F4 규칙)
      setStep({ name: 'error' })
    }
  }, [canSearch, trimmed])

  // 검색 중 취소 — 요청을 끊고 입력으로 복귀(결과·기록에 미반영, 한도는 서버 접수 기준)
  const cancelSearch = useCallback(() => {
    abortRef.current?.abort()
    track('ai_search_cancel', { elapsed_ms: Math.round(performance.now() - startedAtRef.current) })
    setStep({ name: 'input' })
  }, [])

  /**
   * 후보 선택 확정 — 유일한 저장 시점. 성공 시에만 true.
   * 서버가 ai-key를 재계산·검증하고 upsert + (로그인 시) 검색 기록 + 계측을 수행한다.
   */
  const ensureSelected = useCallback(
    async (r: AcrResult, rank: number): Promise<boolean> => {
      const key = r.acrid
      if (!key) return false
      if (selectedKeys.has(key)) return true
      if (selectBusyRef.current.has(key)) return false
      selectBusyRef.current.add(key)
      try {
        await selectCandidate(r, rank + 1) // 서버 rank는 1부터
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
      // ♡는 곡 row가 먼저 있어야 한다(R5) — 선택 확정 후 기존 즐겨찾기 흐름으로
      if (await ensureSelected(r, rank)) onFavorite(r, rank)
    },
    [ensureSelected, onFavorite],
  )

  return (
    <div className="flex flex-1 flex-col">
      {/* ── 입력 ── */}
      {step.name === 'input' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-1 flex-col gap-4 pt-6"
        >
          <div>
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em]">
              말로 설명해서
              <br />
              찾아볼게요
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              기억나는 가사·분위기·상황을 자유롭게 적어주세요
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, MAX_LEN))}
              rows={4}
              placeholder={"예) 여자 보컬 드라마 OST였고\n가사에 '바람'이 들어가요"}
              className="w-full resize-none rounded-2xl border border-input bg-card p-4 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="self-end text-xs tabular-nums text-muted-foreground">
              {trimmed.length}/{MAX_LEN}
            </span>
          </div>
          <div className="mt-auto pb-2">
            <Button
              type="button"
              onClick={() => void runTextSearch()}
              disabled={!canSearch}
              size="lg"
              className="h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
            >
              <Sparkles /> AI로 찾기
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── 검색 중 ── */}
      {step.name === 'searching' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col gap-4 pt-6">
          <div>
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em]">AI가 찾는 중…</h2>
            <p className="mt-1 text-sm text-muted-foreground">설명과 맞는 곡을 추려내고 있어요</p>
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

      {/* ── 후보 목록 ── */}
      {step.name === 'candidates' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col gap-4 pt-6">
          <div>
            <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em]">이 중에 있나요?</h2>
            <p className="mt-1 text-sm text-muted-foreground">곡을 누르면 찾은 곡으로 저장돼요</p>
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
                      {selected && (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-iris/15 px-2 py-0.5 text-xs font-bold text-iris-soft">
                          <Check className="size-3" /> 찾은 곡으로 저장됨
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
          <div className="mt-auto pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep({ name: 'input' })}
              size="lg"
              className="h-11 w-full rounded-full text-sm font-semibold transition-transform active:scale-[0.97]"
            >
              <Search /> 다시 설명해서 찾기
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── 무후보(US3) — 오류가 아닌 안내 + 입력 유지 재시도 ── */}
      {step.name === 'empty' && (
        <FailureView
          icon={Search}
          tone="neutral"
          title="후보를 찾지 못했어요"
          body={'단서를 조금만 더 주세요.\n가사 한 소절, 발표 시기, 장르,\n어디서 들었는지가 큰 도움이 돼요'}
          actions={[
            { label: '다시 설명하기', onClick: () => setStep({ name: 'input' }), primary: true },
            { label: '돌아가기', onClick: onBack },
          ]}
        />
      )}

      {/* ── 오류(502·타임아웃) — F4 패턴 ── */}
      {step.name === 'error' && (
        <FailureView
          icon={AlertCircle}
          tone="danger"
          title="AI 검색이 잠시 원활하지 않아요"
          body={'입력한 설명은 그대로 있어요.\n잠시 후 다시 시도해주세요'}
          actions={[
            { label: '재시도', onClick: () => void runTextSearch(), primary: true },
            { label: '입력 수정', onClick: () => setStep({ name: 'input' }) },
          ]}
        />
      )}

      {/* ── 일일 한도 초과(429) ── */}
      {step.name === 'quota' && (
        <FailureView
          icon={Hourglass}
          tone="warning"
          title="오늘의 AI 검색을 모두 사용했어요"
          body={`${resetTimeLabel(step.resetAt)}에 다시 사용할 수 있어요.\n녹음 검색은 계속 이용할 수 있어요`}
          actions={[{ label: '돌아가기', onClick: onBack, primary: true }]}
        />
      )}
    </div>
  )
}
