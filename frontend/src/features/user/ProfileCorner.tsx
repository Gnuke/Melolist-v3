import { useState } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { useMe } from '@/features/user/useMe'
import { ProfileAvatar } from '@/features/user/ProfileAvatar'
import { ProfileSheet } from '@/features/user/ProfileSheet'

/**
 * 헤더 우측 프로필 칩 + 시트 — 탭 화면 공용 계정 진입점(프로필 관리·로그아웃).
 * 게스트면 아무것도 렌더하지 않는다(로그인 유도는 화면별 가드·CTA 몫).
 */
export function ProfileCorner() {
  const session = useAuthStore((s) => s.session)
  const [open, setOpen] = useState(false)

  if (!session) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="내 프로필"
        className="rounded-full transition-transform focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 active:scale-95"
      >
        <Chip fallbackEmail={session.user.email} />
      </button>
      <ProfileSheet open={open} onClose={() => setOpen(false)} fallbackEmail={session.user.email} />
    </>
  )
}

/** 첫 조회가 profiles JIT 프로비저닝을 트리거한다(spec 001). */
function Chip({ fallbackEmail }: { fallbackEmail?: string }) {
  const { data: me } = useMe(true)
  const label = me?.displayName || me?.email || fallbackEmail || ''
  return <ProfileAvatar avatarUrl={me?.avatarUrl} label={label} className="size-7 text-[12px]" />
}
