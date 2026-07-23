import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  icon: LucideIcon
  /** 아이콘 원 배경·전경 톤 (예: "bg-brand/12 text-brand") — 탭별 컬러를 그대로 잇는다 */
  iconClassName: string
  title: string
  description: ReactNode
  /** 로그인 후 복귀 경로 — LoginPage가 state.next로 받는다(FR-004) */
  next: string
}

/**
 * 게스트가 보호 탭(즐겨찾기·기록·플레이리스트)에 들어왔을 때의 인라인 로그인 유도.
 * /login으로 리다이렉트하지 않고 탭 셸(BottomNav)을 유지한 채 빈 상태 패턴으로
 * 보여준다 — 로그인 화면 이동은 CTA를 눌렀을 때만.
 */
export function GuestPrompt({ icon: Icon, iconClassName, title, description, next }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 pb-16 text-center">
      <span className={cn('flex size-14 items-center justify-center rounded-full', iconClassName)}>
        <Icon className="size-6" />
      </span>
      <div>
        <p className="text-[17px] font-extrabold tracking-tight">{title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Button asChild size="lg" className="h-12 rounded-full px-7 text-sm font-bold transition-transform active:scale-[0.97]">
        <Link to="/login" state={{ next }}>
          <LogIn /> 로그인하러 가기
        </Link>
      </Button>
    </div>
  )
}
