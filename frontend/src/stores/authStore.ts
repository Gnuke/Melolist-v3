import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  setSession: (session: Session | null) => void
}

/** Supabase 세션/유저의 전역 UI 상태 (서버 데이터는 TanStack Query가 담당). */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
}))
