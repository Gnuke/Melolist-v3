import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminGuard } from '@/features/admin/useAdminGuard'

/** 자식 라우트가 useOutletContext로 받는 컨텍스트 — 사용자 화면(self-demotion 판정)에서 사용. */
export interface AdminOutletContext {
  meId: string
}

const TABS = [
  { to: '/admin', label: '대시보드', end: true },
  { to: '/admin/music', label: '곡 카탈로그', end: false },
  { to: '/admin/users', label: '사용자', end: false },
]

/**
 * 어드민 셸 — 접근 가드 + 데스크톱 우선 와이드 레이아웃(기존 앱 max-w-md의 의도적 예외).
 * 진입은 URL 직접 접근만(FR-002) · 비관리자는 홈으로 조용히 리다이렉트(존재 비노출).
 * 이 영역에서는 계측 이벤트를 발화하지 않는다(FR-012) — BottomNav도 미포함.
 */
export function AdminLayout() {
  const guard = useAdminGuard()

  if (guard.status === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (guard.status === 'denied') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 pb-16 pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Melolist</p>
          <h1 className="mt-0.5 text-[26px] font-black leading-tight tracking-[-0.02em]">어드민</h1>
        </div>
        <nav className="flex items-center gap-1 rounded-full border border-border bg-card/60 p-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                  isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mt-8 flex-1">
        <Outlet context={{ meId: guard.meId } satisfies AdminOutletContext} />
      </main>
    </div>
  )
}
