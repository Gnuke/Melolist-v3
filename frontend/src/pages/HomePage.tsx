import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import type { Variants } from 'motion/react'
import { AudioLines, Mic } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CoverArt } from '@/features/search/CoverArt'
import type { RecentFind } from '@/features/search/recentFinds'
import { useRecentFinds } from '@/features/search/useRecentFinds'
import { useAuthStore } from '@/stores/authStore'
import { ProfileCorner } from '@/features/user/ProfileCorner'
import { ThemeToggle } from '@/components/ThemeToggle'

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
}

/** 홈 = 검색 진입(와이어프레임 1b 듀얼 CTA) — 모드별 플로우 차이(자동/수동)를 진입부터 분리(C1). */
export function HomePage() {
  const session = useAuthStore((s) => s.session)
  const recentFinds = useRecentFinds()

  return (
    <div className="relative min-h-dvh overflow-x-hidden">
      {/* 히어로 상단에만 허용되는 은은한 틴트 그라데이션 (DS) — 인식 = iris */}
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-[420px]">
        <div
          className="absolute left-1/2 top-[-180px] size-[560px] -translate-x-1/2 rounded-full opacity-[0.13] blur-[110px]"
          style={{ background: 'radial-gradient(circle, var(--iris-500), transparent 70%)' }}
        />
      </div>

      <motion.div
        className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* 워드마크 — 로고 없음: 플레인 타입 + flame 마침표 (DS)
            높이 h-8은 탭 화면 공통 헤더 규격 — 애니메이션 없이 고정해 탭 전환 시 아바타가 점프하지 않게 한다 */}
        <header className="flex h-8 items-center justify-between">
          <h1 className="text-[21px] font-black tracking-[-0.02em]">
            Melolist<span className="text-brand">.</span>
          </h1>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {session ? (
              <ProfileCorner />
            ) : (
              <Button asChild variant="ghost" size="sm" className="rounded-full text-muted-foreground hover:text-foreground">
                <Link to="/login">로그인</Link>
              </Button>
            )}
          </div>
        </header>

        {/* 헤드라인 */}
        <motion.div variants={itemVariants} className="mt-14">
          <h2 className="text-[30px] font-black leading-[1.18] tracking-[-0.03em]">
            어떤 노래였는지
            <br />
            기억나지 않나요?
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            잠깐 들려주거나 직접 불러보세요. 바로 찾아드려요.
          </p>
        </motion.div>

        {/* 듀얼 CTA (1b) */}
        <motion.nav variants={itemVariants} className="mt-8 flex flex-col gap-3">
          <Link to="/search/fingerprint" className="group block focus-visible:outline-none">
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-4 rounded-2xl bg-primary p-5 text-primary-foreground shadow-md transition-colors group-hover:bg-brand-hover group-focus-visible:ring-[3px] group-focus-visible:ring-ring/60"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white/18">
                <Mic className="size-6" />
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-extrabold tracking-tight">노래 찾기</span>
                <span className="mt-0.5 block text-[13px] text-white/75">
                  주변에 흐르는 음악 · 12초 자동
                </span>
              </span>
            </motion.div>
          </Link>

          <Link to="/search/humming" className="group block focus-visible:outline-none">
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors group-hover:bg-accent group-focus-visible:ring-[3px] group-focus-visible:ring-ring/60"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-iris/15">
                <AudioLines className="size-6 text-iris-soft" />
              </span>
              <span className="min-w-0">
                <span className="block text-[17px] font-extrabold tracking-tight">허밍으로 찾기</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">
                  직접 불러서 · 최대 20초
                </span>
              </span>
            </motion.div>
          </Link>
        </motion.nav>

        {/* 최근 찾은 곡 — 로그인=서버 기록, 게스트=로컬 (useRecentFinds) */}
        {recentFinds.length > 0 && (
          <motion.section variants={itemVariants} className="mt-auto pt-12">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
              최근 찾은 곡
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {recentFinds.map((f) =>
                f.youtubeUrl ? (
                  <a
                    key={f.key}
                    href={f.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-xl border border-border bg-card/60 p-2.5 transition-colors hover:bg-accent"
                  >
                    <RecentFindBody f={f} />
                  </a>
                ) : (
                  <div key={f.key} className="rounded-xl border border-border bg-card/60 p-2.5">
                    <RecentFindBody f={f} />
                  </div>
                ),
              )}
            </div>
          </motion.section>
        )}
      </motion.div>
    </div>
  )
}

function RecentFindBody({ f }: { f: RecentFind }) {
  return (
    <>
      <CoverArt coverUrl={f.coverUrl} videoId={f.videoId} alt={f.title} className="aspect-square w-full" />
      <p className="mt-2 truncate text-xs font-semibold">{f.title}</p>
      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{f.artist}</p>
    </>
  )
}
