import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // 미설정이어도 앱이 뜨도록 placeholder로 생성 (실제 인증 호출 시에만 실패).
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 미설정 — .env를 확인하세요.')
}

export const supabase = createClient(
  url || 'http://localhost:54321',
  anonKey || 'anon-key-placeholder',
)
