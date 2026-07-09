import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'motion/react'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import { router } from '@/routes/router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { trackVisitOnce } from '@/features/events/track'
import { Toaster } from '@/components/ui/sonner'
import './index.css'

// Supabase 세션을 전역 스토어에 동기화 (로그인/로그아웃/토큰갱신 반영)
void supabase.auth.getSession().then(({ data }) => {
  useAuthStore.getState().setSession(data.session)
})
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session)
})

// C5: visit은 앱 로드 시 세션당 1회 (KR3 분모)
trackVisitOnce()

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <RouterProvider router={router} />
      </MotionConfig>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  </StrictMode>,
)
