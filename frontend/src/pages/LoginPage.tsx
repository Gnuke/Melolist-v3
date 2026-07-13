import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const signInWithGoogle = async () => {
    // 로그인 후 현재 오리진(로컬 5173/운영 Vercel)으로 복귀 — Supabase Redirect URLs에 등록된 주소여야 함
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-4">
      <header>
        <Button asChild variant="ghost" size="sm" className="-ml-2 rounded-full text-muted-foreground hover:text-foreground">
          <Link to="/">
            <ChevronLeft /> 홈
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
