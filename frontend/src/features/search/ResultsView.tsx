import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { ExternalLink, Heart, Play, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CoverArt } from './CoverArt'
import type { AcrResult, SearchType } from './types'

interface Props {
  mode: SearchType
  results: AcrResult[]
  /** F3: 허밍 저신뢰 — 최고 1건 + 배너 + [다시 불러보기] */
  lowScore: boolean
  onFavorite: (r: AcrResult) => void
  onRetrySame: () => void
  onReRecord: () => void
}

function artistName(artists?: AcrResult['artists']) {
  const n = artists?.[0]?.name
  return n && n.trim().length > 0 ? n : '미상'
}

function metaLine(r: AcrResult) {
  const year = r.release_date?.slice(0, 4)
  return [artistName(r.artists), r.album?.name, year].filter(Boolean).join(' · ')
}

function scorePercent(r: AcrResult) {
  return Math.round((r.score ?? 0) * 100)
}

function rowKey(r: AcrResult, i: number) {
  return r.acrid ?? r.youtube_url ?? `${r.title ?? ''}-${artistName(r.artists)}-${i}`
}

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { type: 'spring', stiffness: 260, damping: 24 } },
}

function ListenLink({ r, hero = false }: { r: AcrResult; hero?: boolean }) {
  if (!r.youtube_url) return null
  if (hero) {
    return (
      <Button asChild size="lg" className="h-11 flex-1 rounded-full text-sm font-bold transition-transform active:scale-[0.97]">
        <a href={r.youtube_url} target="_blank" rel="noopener noreferrer">
          <Play className="fill-current" /> YouTube에서 듣기
        </a>
      </Button>
    )
  }
  return (
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
  )
}

function FavoriteButton({
  onClick,
  subtle = false,
}: {
  onClick: () => void
  subtle?: boolean
}) {
  return (
    <Button
      type="button"
      variant={subtle ? 'ghost' : 'outline'}
      size={subtle ? 'icon-sm' : 'icon-lg'}
      onClick={onClick}
      className="rounded-full text-muted-foreground transition-transform hover:text-brand active:scale-90"
      aria-label="즐겨찾기"
    >
      <Heart />
    </Button>
  )
}

/**
 * 검색 결과(C2·C3) — Top-3 고정.
 * 지문 = 히어로형(1j, score 숨김) / 허밍 = 동등 리스트형(1i, 일치율 노출) — 모드별 혼합안.
 */
export function ResultsView({ mode, results, lowScore, onFavorite, onRetrySame, onReRecord }: Props) {
  const top3 = results.slice(0, 3)
  const [first, ...rest] = top3
  if (!first) return null

  const heroLayout = mode === 'fingerprint'

  return (
    <motion.div variants={listVariants} initial="hidden" animate="show" className="flex flex-1 flex-col gap-4">
      {/* 헤더 */}
      <motion.div variants={itemVariants}>
        <h2 className="text-[26px] font-black leading-tight tracking-[-0.02em]">
          {lowScore ? '아쉽지만, 가장 가까운 곡이에요' : heroLayout ? '찾았어요!' : '이 곡인 것 같아요'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {lowScore
            ? '일치율이 낮아요 — 후렴구를 10초 이상 불러주면 더 정확해요'
            : heroLayout
              ? '주변에서 들리던 그 곡이에요'
              : `후보 ${top3.length}곡을 찾았어요`}
        </p>
      </motion.div>

      {heroLayout ? (
        <>
          {/* 히어로 카드 (1j) — 지문은 score 숨김(확정) */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col gap-4 rounded-2xl border border-white/12 bg-card p-4"
          >
            <div className="flex items-center gap-4">
              <CoverArt coverUrl={first.cover_url} videoId={first.youtube_video_id} alt={first.title ?? ''} className="size-20" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold tracking-tight">{first.title ?? '-'}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{metaLine(first)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ListenLink r={first} hero />
              <FavoriteButton onClick={() => onFavorite(first)} />
            </div>
          </motion.div>

          {/* 차순위 (컴팩트) */}
          {rest.length > 0 && (
            <motion.div variants={itemVariants} className="flex flex-col gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                이 곡이 아니에요?
              </p>
              {rest.map((r, i) => (
                <div
                  key={rowKey(r, i + 1)}
                  className="flex items-center gap-3 rounded-xl border border-white/7 bg-card/60 p-2.5"
                >
                  <CoverArt coverUrl={r.cover_url} videoId={r.youtube_video_id} alt={r.title ?? ''} className="size-10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{r.title ?? '-'}</p>
                    <p className="truncate text-xs text-muted-foreground">{artistName(r.artists)}</p>
                  </div>
                  <ListenLink r={r} />
                  <FavoriteButton subtle onClick={() => onFavorite(r)} />
                </div>
              ))}
            </motion.div>
          )}
        </>
      ) : (
        /* 동등 리스트 (1i) — 허밍은 일치율 비교가 핵심 */
        <motion.ul variants={listVariants} className="flex flex-col gap-2.5">
          {top3.map((r, i) => (
            <motion.li
              key={rowKey(r, i)}
              variants={itemVariants}
              className={
                i === 0
                  ? 'flex items-center gap-3.5 rounded-2xl border border-white/15 bg-card p-3.5'
                  : 'flex items-center gap-3.5 rounded-2xl border border-white/7 bg-card/60 p-3.5'
              }
            >
              <CoverArt coverUrl={r.cover_url} videoId={r.youtube_video_id} alt={r.title ?? ''} className="size-14" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">{r.title ?? '-'}</p>
                <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{artistName(r.artists)}</p>
                <span className="mt-1.5 inline-block rounded-full bg-iris/15 px-2 py-0.5 text-xs font-bold text-iris-soft">
                  일치율 {scorePercent(r)}%
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ListenLink r={r} />
                <FavoriteButton subtle onClick={() => onFavorite(r)} />
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {/* 하단 액션 — 같은 녹음 재검색(blob 보존) / 다시 녹음 */}
      <motion.div variants={itemVariants} className="mt-auto flex gap-2 pt-4">
        {lowScore ? (
          <Button
            type="button"
            onClick={onReRecord}
            size="lg"
            className="h-11 flex-1 rounded-full text-sm font-bold transition-transform active:scale-[0.97]"
          >
            <RotateCcw /> 다시 불러보기
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onReRecord}
            variant="outline"
            size="lg"
            className="h-11 flex-1 rounded-full text-sm font-semibold transition-transform active:scale-[0.97]"
          >
            <RotateCcw /> 다시 녹음
          </Button>
        )}
        <Button
          type="button"
          onClick={onRetrySame}
          variant="outline"
          size="lg"
          className="h-11 flex-1 rounded-full text-sm font-semibold transition-transform active:scale-[0.97]"
        >
          <RefreshCw /> 같은 녹음으로 재검색
        </Button>
      </motion.div>
    </motion.div>
  )
}
