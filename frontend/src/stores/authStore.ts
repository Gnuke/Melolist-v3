import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'

interface AuthState {
  session: Session | null
  user: User | null
  /** 첫 getSession 완료 여부 — 새로고침 직후 세션 null을 "비로그인"으로 오판하지 않기 위함 */
  initialized: boolean
  setSession: (session: Session | null) => void
}

/** Supabase 세션/유저의 전역 UI 상태 (서버 데이터는 TanStack Query가 담당). */
export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  initialized: false,
  setSession: (session) => set({ session, user: session?.user ?? null, initialized: true }),
}))
