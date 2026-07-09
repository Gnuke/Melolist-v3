import { useEffect, useState } from 'react'
import { Music2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  coverUrl?: string | null
  videoId?: string
  alt?: string
  className?: string
}

/**
 * 결과 카드 커버(C2·D3) — 2단 onError 폴백:
 * cover_url → i.ytimg.com/vi/{videoId}/mqdefault.jpg → 음표 플레이스홀더.
 * 고정 크기(레이아웃 시프트 방지)는 className(size-14 등)으로 지정한다.
 */
export function CoverArt({ coverUrl, videoId, alt = '', className }: Props) {
  const sources = [
    ...(coverUrl ? [coverUrl] : []),
    ...(videoId ? [`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`] : []),
  ]
  const [step, setStep] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const src = sources[step]

  // 결과가 바뀌면 폴백 체인 리셋
  useEffect(() => {
    setStep(0)
    setLoaded(false)
  }, [coverUrl, videoId])

  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-[10px] bg-secondary',
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false)
            setStep((s) => s + 1)
          }}
          className={cn(
            'size-full object-cover transition-opacity duration-300',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/60">
          <Music2 className="size-[38%]" />
        </div>
      )}
      {/* DS: 커버는 1px 내부 헤어라인 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-white/10" />
    </div>
  )
}
