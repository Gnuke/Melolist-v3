import { toast } from 'sonner'
import type { Session } from '@supabase/supabase-js'
import { useAuthStore } from '@/stores/authStore'
import { track } from '@/features/events/track'

/**
 * 로그인 계측(spec 001 FR-009) — OAuth는 전체 페이지 리다이렉트라
 * "시작"은 sessionStorage 플래그로 표시해 두고, 복귀 후 앱 로드 시점에
 * 성공/실패를 판정해 발화한다(같은 탭 = 같은 sessionStorage).
 */
const PENDING_KEY = 'melolist.login-pending'

/** 로그인 버튼 클릭 시점 — OAuth 리다이렉트 전에 호출한다. */
export function trackLoginStarted(): void {
  sessionStorage.setItem(PENDING_KEY, '1')
  track('login_started', { provider: 'google' })
}

/**
 * OAuth 복귀 대기 중 여부 — 복귀 페이지가 마운트 렌더 시점(consumeLoginReturn이
 * 플래그를 소거하기 전)에 화면 상태 복원(FR-004) 여부를 판단하는 데 쓴다.
 */
export function hasPendingLoginReturn(): boolean {
  return sessionStorage.getItem(PENDING_KEY) !== null
}

/** 리다이렉트조차 못 간 즉시 실패(네트워크 등) — 복귀 판정 경로를 안 타므로 직접 기록. */
export function trackLoginFailedImmediate(errorCode: string | null): void {
  sessionStorage.removeItem(PENDING_KEY)
  track('login_failed', { provider: 'google', reason: 'error', error_code: errorCode })
}

const ERROR_PARAM_KEYS = ['error', 'error_code', 'error_description'] as const

/** Supabase가 복귀 URL에 실어주는 인증 에러 파라미터(hash 또는 query)를 읽는다. */
function readAuthErrorFromUrl(): { error: string; code: string | null } | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const query = new URLSearchParams(window.location.search)
  const error = hash.get('error') ?? query.get('error')
  if (!error) return null
  return { error, code: hash.get('error_code') ?? query.get('error_code') }
}

/** 인증 에러 파라미터만 URL에서 제거한다(다른 파라미터·경로는 보존). */
function stripAuthErrorParams(): void {
  const url = new URL(window.location.href)
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
  for (const key of ERROR_PARAM_KEYS) {
    url.searchParams.delete(key)
    hash.delete(key)
  }
  url.hash = hash.toString()
  window.history.replaceState(null, '', url.toString())
}

/**
 * OAuth 복귀 판정 — 앱 마운트 후 1회 호출.
 * 에러 복귀면 안내 토스트 + login_failed, 세션이 생겼으면 login_succeeded.
 * 플래그·에러 파라미터를 소거하므로 재호출(StrictMode 이중 실행)에 멱등.
 */
export async function consumeLoginReturn(): Promise<void> {
  const pending = sessionStorage.getItem(PENDING_KEY) !== null
  if (pending) sessionStorage.removeItem(PENDING_KEY)

  const authError = readAuthErrorFromUrl()
  if (authError) {
    stripAuthErrorParams()
    // Google 동의 화면 취소는 access_denied로 돌아온다 — 오류가 아닌 정상 흐름(FR-005)
    const cancelled = authError.error === 'access_denied'
    if (pending) {
      track('login_failed', {
        provider: 'google',
        reason: cancelled ? 'cancelled' : 'error',
        error_code: authError.code,
      })
    }
    toast(
      cancelled
        ? '로그인이 취소되었어요. 언제든 다시 시도할 수 있어요.'
        : '로그인에 문제가 생겼어요. 잠시 후 다시 시도해주세요.',
    )
    return
  }

  if (!pending) return
  const session = await waitForSession(10_000)
  if (session) {
    track('login_succeeded', { provider: 'google' })
  }
  // 세션이 끝내 없으면(동의 화면에서 뒤로가기 등 중도 이탈) 아무것도 기록하지 않는다
  // — 오류가 아니므로 login_failed로 잡으면 SC-002가 오염된다.
}

/**
 * OAuth 복귀 직후 세션 확립 대기. getSession() 단발 호출은 URL 토큰 교환이
 * 끝나기 전이면 null을 줄 수 있어(이벤트 조용히 유실), 스토어 값을 먼저 보고
 * 없으면 스토어 구독으로 세션 등장을 기다린다(최대 timeoutMs).
 * main.tsx가 onAuthStateChange → 스토어 동기화를 앱 부팅 시 등록해 둔다.
 */
function waitForSession(timeoutMs: number): Promise<Session | null> {
  const immediate = useAuthStore.getState().session
  if (immediate) return Promise.resolve(immediate)

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let unsubscribe: (() => void) | undefined
    let settled = false
    const finish = (session: Session | null) => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      unsubscribe?.()
      resolve(session)
    }
    unsubscribe = useAuthStore.subscribe((state) => {
      if (state.session) finish(state.session)
    })
    timer = setTimeout(() => finish(useAuthStore.getState().session), timeoutMs)
  })
}
