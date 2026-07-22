export interface BarListItem {
  key: string
  label: string
  sub?: string
  count: number
}

/**
 * 수평 바 리스트 — 실패 분포·주간 추이 공용(신규 차트 의존성 없이 CSS 바만 — research R3).
 * 폭은 목록 내 최댓값 대비 상대 비율. 색은 뉴트럴(iris/flame은 DS상 용도 예약 — §10).
 */
export function BarList({ items, unit }: { items: BarListItem[]; unit?: string }) {
  const max = Math.max(...items.map((i) => i.count), 1)
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-3">
          <div className="w-44 shrink-0 text-right">
            <p className="truncate text-[13px] font-semibold">{item.label}</p>
            {item.sub && <p className="truncate text-[11px] text-muted-foreground">{item.sub}</p>}
          </div>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-foreground/25"
              style={{ width: `${Math.max(2, Math.round((item.count / max) * 100))}%` }}
            />
          </div>
          <p className="w-20 shrink-0 text-[13px] font-bold tabular-nums">
            {item.count.toLocaleString()}
            {unit && <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">{unit}</span>}
          </p>
        </li>
      ))}
    </ul>
  )
}
