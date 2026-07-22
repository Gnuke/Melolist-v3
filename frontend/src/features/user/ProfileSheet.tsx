import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { LogOut, UserRound } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { clearCachedMe, useMe } from '@/features/user/useMe'
import { ProfileAvatar } from '@/features/user/ProfileAvatar'

interface Props {
  open: boolean
  onClose: () => void
  fallbackEmail?: string
}

/**
 * 프로필 바텀 시트(spec 001 US3) — 내 정보 확인 + [프로필 관리] 진입 + 로그아웃.
 * 시트 패턴은 FavoriteSheet와 동일.
 */
export function ProfileSheet({ open, onClose, fallbackEmail }: Props) {
  const navigate = useNavigate()
  const { data: me } = useMe(open)
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const signOut = async () => {
    setSigningOut(true)
    const { error } = await supabase.auth.signOut()
    setSigningOut(false)
    if (error) {
      toast('로그아웃에 실패했어요. 잠시 후 다시 시도해주세요.')
      return
    }
    // 다음 로그인이 다른 계정일 수 있으니 내 프로필 캐시(쿼리+로컬 사본)를 비운다
    queryClient.removeQueries({ queryKey: ['me'] })
    clearCachedMe()
    onClose()
    toast('로그아웃되었어요')
  }

  const label = me?.displayName || me?.email || fallbackEmail || ''

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="relative w-full max-w-md rounded-t-[24px] border-t border-input bg-card px-6 pb-8 pt-3"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-foreground/15" />
            <div className="flex items-center gap-3.5">
              <ProfileAvatar avatarUrl={me?.avatarUrl} label={label} className="size-11 text-[17px]" />
              <div className="min-w-0">
                <p className="truncate text-[17px] font-extrabold tracking-tight">{label}</p>
                {me?.email && me.displayName && (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{me.email}</p>
                )}
              </div>
            </div>
            {/* 즐겨찾기·검색 기록 진입점은 하단 탭 내비로 통합(07-16) — 시트는 계정 영역만 담당 */}
            <Button
              type="button"
              onClick={() => {
                onClose()
                navigate('/profile')
              }}
              size="lg"
              className="mt-6 h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
            >
              <UserRound className="size-4" /> 프로필 관리
            </Button>
            <Button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              variant="outline"
              size="lg"
              className="mt-3 h-12 w-full rounded-full bg-card text-[15px] font-bold transition-transform active:scale-[0.97]"
            >
              <LogOut className="size-4" /> 로그아웃
            </Button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              닫기
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
