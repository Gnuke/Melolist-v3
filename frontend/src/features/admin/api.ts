import { isAxiosError } from 'axios'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import type {
  AdminIdentity,
  AdminMetrics,
  AdminRole,
  MusicAdminItem,
  MusicAdminPatch,
  MusicListParams,
  PageResponse,
  UserAdminItem,
  UserListParams,
} from './types'

/**
 * 어드민 API 클라이언트 — contracts/admin-api.md 구현.
 * 각 함수는 먼저 adminMock에 위임한다(dev 전용 — DEV 가드 + 동적 import라
 * 프로덕션 번들에는 mock이 포함되지 않음, searchMock과 동일 패턴).
 * mock이 undefined를 반환하면(비활성) 실제 API로 진행한다.
 */
async function adminMock() {
  if (!import.meta.env.DEV) return null
  return await import('@/mock/adminMock')
}

/**
 * 가드 판정용 신원(id·role) — 비로그인이면 null(게스트).
 * 실 모드에선 기존 GET /users/me(role 필드 기존재)를 그대로 사용한다.
 */
export async function fetchAdminIdentity(): Promise<AdminIdentity | null> {
  const mock = await adminMock()
  if (mock) {
    const mocked = mock.maybeMockIdentity()
    if (mocked !== undefined) return mocked
  }
  if (!useAuthStore.getState().session) return null
  const { data } = await api.get<AdminIdentity>('/users/me')
  return { id: data.id, role: data.role }
}

export async function fetchAdminMetrics(days: number): Promise<AdminMetrics> {
  const mock = await adminMock()
  if (mock) {
    const mocked = await mock.maybeMockMetrics(days)
    if (mocked !== undefined) return mocked
  }
  const { data } = await api.get<AdminMetrics>('/admin/metrics', { params: { days } })
  return data
}

export async function fetchAdminMusic(params: MusicListParams): Promise<PageResponse<MusicAdminItem>> {
  const mock = await adminMock()
  if (mock) {
    const mocked = await mock.maybeMockMusicList(params)
    if (mocked !== undefined) return mocked
  }
  const { data } = await api.get<PageResponse<MusicAdminItem>>('/admin/music', { params })
  return data
}

export async function updateAdminMusic(id: number, patch: MusicAdminPatch): Promise<MusicAdminItem> {
  const mock = await adminMock()
  if (mock) {
    const mocked = await mock.maybeMockMusicUpdate(id, patch)
    if (mocked !== undefined) return mocked
  }
  const { data } = await api.patch<MusicAdminItem>(`/admin/music/${id}`, patch)
  return data
}

export async function fetchAdminUsers(params: UserListParams): Promise<PageResponse<UserAdminItem>> {
  const mock = await adminMock()
  if (mock) {
    const mocked = await mock.maybeMockUserList(params)
    if (mocked !== undefined) return mocked
  }
  const { data } = await api.get<PageResponse<UserAdminItem>>('/admin/users', { params })
  return data
}

export async function updateAdminUserRole(id: string, role: AdminRole): Promise<UserAdminItem> {
  const mock = await adminMock()
  if (mock) {
    const mocked = await mock.maybeMockUserRoleUpdate(id, role)
    if (mocked !== undefined) return mocked
  }
  const { data } = await api.patch<UserAdminItem>(`/admin/users/${id}/role`, { role })
  return data
}

/** 이용 중 권한 상실(401/403) 감지 — 페이지는 이 판정 시 denied로 전환한다(data-model §5). */
export function isAdminAuthError(err: unknown): boolean {
  return isAxiosError(err) && (err.response?.status === 401 || err.response?.status === 403)
}
