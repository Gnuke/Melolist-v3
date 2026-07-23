import { Link, Navigate, useLocation } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { trackLoginFailedImmediate, trackLoginStarted } from '@/features/events/loginEvents'

export function LoginPage() {
  const session = useAuthStore((s) => s.session)
  const location = useLocation()

  // FR-004: 로그인을 유도한 화면이 state.next로 복귀 경로를 넘긴다(없으면 홈). 내부 경로만 허용.
  const rawNext = (location.state as { next?: string } | null)?.next
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

  // 이미 로그인한 상태로 로그인 화면 접근 시 홈(또는 이전 화면)으로 안내 (spec 001 edge case)
  if (session) {
    return <Navigate to={next} replace />
  }

  const signInWithGoogle = async () => {
    trackLoginStarted()
    // 로그인 후 시작 맥락으로 복귀 — origin+next가 Supabase Redirect URLs(와일드카드 /**)에 허용돼야 함
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + next },
    })
    if (error) {
      trackLoginFailedImmediate(error.code ?? null)
      toast('로그인에 문제가 생겼어요. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-4">
      <header>
        {/* 뒤로가기도 로그인을 유도한 화면으로 — 탭에서 왔다가 로그인 없이 나가도 그 탭으로 복귀 */}
        <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full text-muted-foreground hover:text-foreground">
          <Link to={next}>
            <ChevronLeft /> {next === '/' ? '홈' : '뒤로'}
          </Link>
        </Button>
      </header>

      <motion.div
        className="flex flex-1 flex-col justify-center gap-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div>
          <p className="text-[21px] font-black tracking-[-0.02em]">
            Melolist<span className="text-brand">.</span>
          </p>
          <h1 className="mt-6 text-[28px] font-black leading-[1.2] tracking-[-0.03em]">
            찾은 곡,
            <br />
            이제 모아두세요
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            로그인하면 즐겨찾기와 검색 기록이 계정에 저장돼요
          </p>
        </div>

        <Button
          type="button"
          onClick={signInWithGoogle}
          variant="outline"
          size="lg"
          className="h-12 w-full rounded-full bg-card text-[15px] font-bold transition-transform active:scale-[0.97]"
        >
          Google로 계속하기
        </Button>
      </motion.div>
    </main>
  )
}
