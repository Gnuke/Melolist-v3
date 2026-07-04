import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { RecordPanel } from '@/features/search/RecordPanel'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'

/** 홈 = 음악 검색 화면 (게스트 허용). v2 Record 화면을 프리미엄 다크 UI로 재설계. */
export function HomePage() {
  const session = useAuthStore((s) => s.session)

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      {/* 배경 글로우 (깊이감) */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute left-1/2 top-[-15%] size-[680px] -translate-x-1/2 rounded-full opacity-20 blur-[130px]"
          style={{ background: 'radial-gradient(circle, #5b8cff, transparent 70%)' }}
        />
      </div>

      <motion.div
        className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pb-20 pt-8 sm:px-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Melolist</h1>
            <p className="mt-1 text-sm text-muted-foreground">흥얼거리거나 들려주면 곡을 찾아드려요</p>
          </div>
          {!session && (
            <Button asChild variant="outline" size="sm" className="transition-transform active:scale-95">
              <Link to="/login">로그인</Link>
            </Button>
          )}
        </header>

        <RecordPanel />
      </motion.div>
    </div>
  )
}
