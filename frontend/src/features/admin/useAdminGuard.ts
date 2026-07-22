import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/authStore'
import { fetchAdminIdentity } from './api'

/** 어드민 접근 판별 상태 (data-model §5). */
export type AdminGuardState =
  | { status: 'checking' }
  | { status: 'denied' }
  | { status: 'granted'; meId: string }

/**
 * 어드민 접근 가드 — 관리자(role=ADMIN)만 granted.
 * 세션 하이드레이션 전(initialized=false)에는 checking 유지(새로고침 직후 오판 방지 —
 * 기존 authStore 가드 패턴). 화면 가드는 UX 장치일 뿐, 데이터 보호의 최종 강제는
 * 백엔드 /api/admin/* 의 401/403이다(계약 §0).
 */
export function useAdminGuard(): AdminGuardState {
  const initialized = useAuthStore((s) => s.initialized)

  const identity = useQuery({
    queryKey: ['admin', 'identity'],
    queryFn: fetchAdminIdentity,
    enabled: initialized,
    staleTime: 60_000,
    retry: false,
  })

  if (!initialized || identity.isPending) return { status: 'checking' }
  const me = identity.data
  if (identity.isError || !me || me.role !== 'ADMIN') return { status: 'denied' }
  return { status: 'granted', meId: me.id }
}
