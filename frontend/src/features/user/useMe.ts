import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

/** 백엔드 GET /api/users/me 응답 (ProfileResponse와 일치). */
export interface Profile {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: string
}

// 마지막 프로필의 로컬 사본 — 새로고침·재방문 첫 렌더에서 "이니셜→실사진" 교체 깜빡임을 없앤다.
// (/users/me 왕복은 Render 콜드스타트 시 수 초라 placeholder 없이는 매 진입마다 깜빡인다)
const CACHE_KEY = 'melolist.me'

/** 프로필 로컬 사본 갱신 — 조회 성공·수정 반영 시 호출해 최신으로 유지한다. */
export function cacheMe(profile: Profile) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(profile))
  } catch {
    // 저장 실패(프라이빗 모드 등)면 다음 진입이 깜빡일 뿐 — 무시
  }
}

/** 현재 로그인 계정의 사본일 때만 돌려준다 — 로그아웃 후에도 사본은 남으므로(같은 계정
 *  재로그인 즉시 표시용) 계정 전환 시 남의 프로필이 보이지 않게 하는 유일한 가드다. */
function readCachedMe(): Profile | undefined {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return undefined
    const cached = JSON.parse(raw) as Profile
    // Profile.id == Supabase auth uid (JIT 프로비저닝이 JWT sub로 생성)
    return cached.id === useAuthStore.getState().user?.id ? cached : undefined
  } catch {
    return undefined
  }
}

async function fetchMe(): Promise<Profile> {
  const { data } = await api.get<Profile>('/users/me')
  cacheMe(data)
  return data
}

/** 로그인 상태(enabled)일 때만 내 프로필을 조회한다. */
export function useMe(enabled: boolean) {
  return useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled,
    placeholderData: readCachedMe,
    // 프로필은 이 앱의 ProfilePage에서만 바뀌고 그땐 setQueryData로 즉시 반영되므로 재조회를 아낀다
    staleTime: 5 * 60_000,
  })
}
