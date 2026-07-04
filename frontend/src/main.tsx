import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes/router'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import './index.css'

// Supabase 세션을 전역 스토어에 동기화 (로그인/로그아웃/토큰갱신 반영)
void supabase.auth.getSession().then(({ data }) => {
  useAuthStore.getState().setSession(data.session)
})
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.getState().setSession(session)
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
