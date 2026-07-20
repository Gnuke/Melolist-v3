import { NavLink } from 'react-router-dom'
import { Heart, History, Home, ListMusic } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', label: '홈', icon: Home, end: true },
  { to: '/favorites', label: '즐겨찾기', icon: Heart, end: false },
  { to: '/playlists', label: '플레이리스트', icon: ListMusic, end: false },
  { to: '/history', label: '기록', icon: History, end: false },
] as const

/**
 * 하단 탭 내비(M3) — 탭 화면(홈·즐겨찾기·플레이리스트·기록)에만 노출. 검색 플로우·로그인은
 * 몰입 유지를 위해 제외(router의 TabLayout 소속만 해당). 활성 표시는 전경색
 * 전환만 — flame은 뷰당 주 액션 1개 규칙(DS §10)이라 내비에 쓰지 않는다.
 */
export function BottomNav() {
  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-background/85 backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex h-16 max-w-md items-stretch px-2">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground/70 hover:text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-[22px]" strokeWidth={isActive ? 2.5 : 2} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
