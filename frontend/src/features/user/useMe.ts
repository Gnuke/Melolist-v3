import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** 백엔드 GET /api/users/me 응답 (ProfileResponse와 일치). */
export interface Profile {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: string
}

async function fetchMe(): Promise<Profile> {
  const { data } = await api.get<Profile>('/users/me')
  return data
}

/** 로그인 상태(enabled)일 때만 내 프로필을 조회한다. */
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled,
  })
}
