import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { ExternalLink, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { AcrResult, SearchType } from './types'

interface Props {
  results: AcrResult[]
  noResultMessage?: string
  lowScoreMessage?: string
  searchType: SearchType
  loading?: boolean
}

function artistName(artists?: AcrResult['artists']) {
  const n = artists?.[0]?.name
  return n && n.trim().length > 0 ? n : '미상'
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

export function SearchResultsList({
  results,
  noResultMessage = '',
  lowScoreMessage = '',
  searchType,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="flex-row items-center justify-between gap-4 p-5">
            <div className="flex w-full flex-col gap-2">
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="h-3.5 w-3/5" />
            </div>
            <Skeleton className="h-9 w-16 rounded-xl" />
          </Card>
        ))}
      </div>
    )
  }

  if (results.length === 0) {
    if (noResultMessage) {
      return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="items-center gap-3 py-10 text-center">
            <SearchX className="size-8 text-muted-foreground/70" />
            <p className="text-base text-muted-foreground">{noResultMessage}</p>
          </Card>
        </motion.div>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">검색 결과</h3>
      {lowScoreMessage && <p className="text-sm text-amber-400/90">{lowScoreMessage}</p>}
      <motion.ul
        className="flex flex-col gap-3"
        variants={listVariants}
        initial="hidden"
        animate="show"
      >
        {results.map((r, i) => (
          <motion.li key={rowKey(r, i)} variants={itemVariants}>
            <Card className="flex-row items-center justify-between gap-4 p-5 transition-colors hover:border-brand/40 hover:bg-card/80">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{r.title ?? '-'}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {searchType === 'fingerprint'
                    ? [artistName(r.artists), r.album?.name, r.release_date].filter(Boolean).join(' · ')
                    : `일치율 ${Math.round((r.score ?? 0) * 100)}%`}
                </p>
              </div>
              {r.youtube_url ? (
                <Button
                  asChild
                  size="sm"
                  className="shrink-0 transition-transform active:scale-95"
                >
                  <a href={r.youtube_url} target="_blank" rel="noopener noreferrer">
                    듣기 <ExternalLink className="size-4" />
                  </a>
                </Button>
              ) : (
                <span className="shrink-0 text-sm text-muted-foreground">-</span>
              )}
            </Card>
          </motion.li>
        ))}
      </motion.ul>
    </div>
  )
}
