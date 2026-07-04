import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' })
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">로그인</h1>
      <button
        type="button"
        onClick={signInWithGoogle}
        className="rounded-lg border border-border px-5 py-2.5 font-medium transition hover:bg-muted"
      >
        Google로 계속하기
      </button>
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← 홈으로
      </Link>
    </main>
  )
}
