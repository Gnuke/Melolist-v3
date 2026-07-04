import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { useMe } from '@/features/user/useMe'

export function HomePage() {
  const session = useAuthStore((s) => s.session)
  const { data: profile, isLoading } = useMe(!!session)

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold">🎤 Melolist</h1>
      <p className="text-muted-foreground">마이크로 흥얼거려 음악을 찾아보세요</p>

      {session ? (
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? '프로필 불러오는 중…'
            : `안녕하세요, ${profile?.displayName ?? profile?.email ?? '사용자'}님`}
        </p>
      ) : (
        <Link
          to="/login"
          className="rounded-lg bg-primary px-5 py-2.5 font-medium text-primary-foreground transition hover:opacity-90"
        >
          로그인
        </Link>
      )}
    </main>
  )
}
