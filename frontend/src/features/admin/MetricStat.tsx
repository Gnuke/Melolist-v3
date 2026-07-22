import { cn } from '@/lib/utils'

/**
 * 스탯 타일 — 라벨·값·(선택) 목표 대비 판정 배지.
 * pass는 서버 판정 값을 그대로 표시한다(프론트 재판정 금지 — data-model §1).
 * value가 null이면 "데이터 없음"(분모 0 등 — 오류 아님).
 */
export function MetricStat({
  label,
  value,
  sub,
  pass,
}: {
  label: string
  value: string | null
  sub?: string
  pass?: boolean
}) {
  return (
    <div className="rounded-2xl border border-white/7 bg-card/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {pass !== undefined && value !== null && (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[11px] font-bold',
              pass ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
            )}
          >
            {pass ? '달성' : '미달'}
          </span>
        )}
      </div>
      {value === null ? (
        <p className="mt-2 text-sm font-semibold text-muted-foreground">데이터 없음</p>
      ) : (
        <p className="mt-1.5 text-2xl font-black tracking-tight">{value}</p>
      )}
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
