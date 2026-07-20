import { api } from '@/lib/api'
import type { Profile } from './useMe'

/**
 * PATCH /api/users/me — 담긴 필드만 수정(M1 계약 보존, user 도메인은 camelCase).
 */
export async function updateMe(values: { displayName?: string; avatarUrl?: string }): Promise<Profile> {
  const { data } = await api.patch<Profile>('/users/me', values)
  return data
}
