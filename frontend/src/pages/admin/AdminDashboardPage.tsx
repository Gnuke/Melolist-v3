import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fetchAdminMetrics, isAdminAuthError } from '@/features/admin/api'
import { MetricStat } from '@/features/admin/MetricStat'
import { BarList } from '@/features/admin/BarList'
import type { SearchMode } from '@/features/admin/types'

const PERIODS = [7, 14, 30, 90] as const

const MODE_LABEL: Record<SearchMode, string> = { fingerprint: '지문', humming: '허밍' }
const modeLabel = (mode: SearchMode | string | null) =>
  mode === null ? '전체' : (MODE_LABEL[mode as SearchMode] ?? mode)

const FAIL_REASON_LABEL: Record<string, string> = {
  bad_audio: '녹음 품질',
  no_match: '무결과',
  low_score: '저신뢰',
  error: '오류',
  timeout: '시간 초과',
  cancelled: '취소',
}

const ms = (v: number) => `${v.toLocaleString()}ms`

/**
 * US1 운영 지표 대시보드 — KR2·KR3를 목표 대비로 표시(수동 SQL 실행 대체, SC-001).
 * 산출·판정은 서버 값 그대로(산식 정본 = kr_metrics.sql — 프론트 재판정 금지).
 */
export function AdminDashboardPage() {
  const [days, setDays] = useState<number>(14)

  const query = useQuery({
    queryKey: ['admin', 'metrics', days],
    queryFn: () => fetchAdminMetrics(days),
  })

  // 이용 중 권한 상실(401/403) → 어드민 이탈(data-model §5)
  if (query.isError && isAdminAuthError(query.error)) return <Navigate to="/" replace />

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">운영 지표</h2>
        <div className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(p)}
              className={cn(
                'rounded-full px-3.5 py-1 text-[13px] font-semibold transition-colors',
                days === p ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p}일
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 py-16 text-center">
          <p className="text-sm text-muted-foreground">지표를 불러오지 못했어요</p>
          <Button type="button" variant="outline" onClick={() => query.refetch()} className="rounded-full px-6 font-semibold">
            다시 시도
          </Button>
        </div>
      ) : (
        <DashboardBody data={query.data} />
      )}
    </div>
  )
}

function DashboardBody({ data }: { data: Awaited<ReturnType<typeof fetchAdminMetrics>> }) {
  const kr2Total = data.kr2.rows.find((r) => r.mode === null)
  const { kr3, totals } = data

  return (
    <>
      {/* KR 목표 + 현황 요약 (FR-003·FR-005) */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MetricStat
          label={`KR2 · 검색 응답 p95 (목표 ≤ ${(data.kr2.target_ms / 1000).toFixed(0)}초)`}
          value={kr2Total ? ms(kr2Total.p95_ms) : null}
          sub={kr2Total ? `표본 ${kr2Total.n.toLocaleString()}건` : '기간 내 검색 없음'}
          pass={kr2Total?.pass}
        />
        <MetricStat
          label={`KR3 · 검색 완료율 (목표 ≥ ${kr3.target_pct}%)`}
          value={kr3.completion_pct === null ? null : `${kr3.completion_pct}%`}
          sub={
            kr3.completion_pct === null
              ? '기간 내 방문 없음'
              : `방문 ${kr3.visit_sessions.toLocaleString()} · 완료 ${kr3.completed_sessions.toLocaleString()} 세션`
          }
          pass={kr3.completion_pct === null ? undefined : kr3.pass}
        />
        <div className="col-span-2 grid grid-cols-4 gap-3 lg:col-span-1 lg:grid-cols-2">
          <MetricStat label="검색(기간)" value={totals.search_count.toLocaleString()} />
          <MetricStat label="매칭(기간)" value={totals.matched_count.toLocaleString()} />
          <MetricStat label="가입자(누적)" value={totals.user_count.toLocaleString()} />
          <MetricStat label="곡 캐시(누적)" value={totals.music_count.toLocaleString()} />
        </div>
      </section>

      {/* KR2 모드별 (FR-003) */}
      <Section title="KR2 모드별 응답 시간">
        {data.kr2.rows.length === 0 ? (
          <EmptyNote />
        ) : (
          <Table
            head={['모드', 'n', '매칭', 'p50', 'p95', 'max', '판정']}
            rows={data.kr2.rows.map((r) => [
              modeLabel(r.mode),
              r.n.toLocaleString(),
              r.matched_n.toLocaleString(),
              ms(r.p50_ms),
              ms(r.p95_ms),
              ms(r.max_ms),
              <PassBadge key="pass" pass={r.pass} />,
            ])}
          />
        )}
      </Section>

      {/* 구간 분해 — 병목 식별 (FR-004) */}
      <Section title="구간 분해 p95" note="upsert는 응답 경로 밖 비동기 측정치예요">
        {data.kr2_breakdown.length === 0 ? (
          <EmptyNote />
        ) : (
          <Table
            head={['모드', 'n', '인식(acr)', '메타 보강', 'upsert(비동기)', '전체']}
            rows={data.kr2_breakdown.map((r) => [
              modeLabel(r.mode),
              r.n.toLocaleString(),
              ms(r.acr_p95_ms),
              ms(r.meta_p95_ms),
              ms(r.upsert_p95_ms),
              ms(r.total_p95_ms),
            ])}
          />
        )}
      </Section>

      {/* 실패 사유 분포 (FR-004) */}
      <Section title="실패 사유 분포">
        {data.failures.length === 0 ? (
          <EmptyNote message="기간 내 실패가 없어요" />
        ) : (
          <BarList
            unit="건"
            items={data.failures.map((f, i) => ({
              key: `${f.mode}-${f.reason}-${i}`,
              label: FAIL_REASON_LABEL[f.reason] ?? f.reason,
              sub: modeLabel(f.mode),
              count: f.n,
            }))}
          />
        )}
      </Section>

      {/* 주간 추이 (FR-004) — 기간 무관 전체 주간, 최신 주 먼저 */}
      <Section title="주간 p95 추이">
        {data.weekly.length === 0 ? (
          <EmptyNote />
        ) : (
          <BarList
            unit="ms"
            items={data.weekly.map((w, i) => ({
              key: `${w.week}-${w.mode}-${i}`,
              label: `${w.week} · ${modeLabel(w.mode)}`,
              sub: `${w.n.toLocaleString()}건`,
              count: w.p95_ms,
            }))}
          />
        )}
      </Section>
    </>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/60 p-5">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-extrabold tracking-tight">{title}</h3>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  )
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            {head.map((h) => (
              <th key={h} className="px-2 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-foreground/5 last:border-0">
              {cells.map((c, j) => (
                <td key={j} className="px-2 py-2.5 font-medium tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PassBadge({ pass }: { pass: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-bold',
        pass ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive',
      )}
    >
      {pass ? '달성' : '미달'}
    </span>
  )
}

function EmptyNote({ message = '이 기간에는 데이터가 없어요' }: { message?: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{message}</p>
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  )
}
