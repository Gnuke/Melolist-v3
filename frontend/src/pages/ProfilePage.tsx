import { useRef, useState, type ChangeEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuthStore } from '@/stores/authStore'
import { cacheMe, useMe, type Profile } from '@/features/user/useMe'
import { ProfileAvatar } from '@/features/user/ProfileAvatar'
import { updateMe } from '@/features/user/api'
import { uploadAvatar } from '@/features/user/avatar'
import { ThemeToggle } from '@/components/ThemeToggle'

/** 프로필 화면(M3) — 별명·프로필 사진 수정. 진입점: 홈 프로필 시트 [프로필 관리]. */
export function ProfilePage() {
  const navigate = useNavigate()
  const session = useAuthStore((s) => s.session)
  const initialized = useAuthStore((s) => s.initialized)
  const queryClient = useQueryClient()
  const query = useMe(!!session)
  const me = query.data
  const [name, setName] = useState<string | null>(null) // null = 아직 입력 전(서버 값 표시)
  const fileRef = useRef<HTMLInputElement>(null)

  const applyMe = (updated: Profile) => {
    queryClient.setQueryData(['me'], updated)
    cacheMe(updated) // 로컬 사본도 갱신 — 다음 새로고침에서 옛 사진이 먼저 뜨지 않게
  }

  const nameSave = useMutation({
    mutationFn: (displayName: string) => updateMe({ displayName }),
    onSuccess: (updated) => {
      applyMe(updated)
      setName(null)
      toast('별명을 바꿨어요')
    },
    onError: () => toast('저장하지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  const avatarSave = useMutation({
    mutationFn: async (file: File) => {
      const url = await uploadAvatar(session!.user.id, file)
      return updateMe({ avatarUrl: url })
    },
    onSuccess: (updated) => {
      applyMe(updated)
      toast('프로필 사진을 바꿨어요')
    },
    onError: () => toast('사진을 올리지 못했어요 — 잠시 후 다시 시도해주세요'),
  })

  // 세션 하이드레이션 전에는 판단 보류(스켈레톤) — 새로고침 직후 오판 방지
  if (initialized && !session) {
    return <Navigate to="/login" state={{ next: '/profile' }} replace />
  }

  const loading = !initialized || query.isPending
  const value = name ?? me?.displayName ?? ''
  const trimmed = value.trim()
  const canSave = name !== null && trimmed.length > 0 && trimmed !== (me?.displayName ?? '')

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 change가 뜨게 초기화
    if (file) avatarSave.mutate(file)
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-28 pt-4">
      <header className="mb-2 flex h-8 items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="-ml-2 rounded-full text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft /> 홈
        </Button>
        {/* 화면 테마는 헤더 공용 토글로 승격 — 탭 화면들과 동일한 위치 */}
        <ThemeToggle />
      </header>

      <div className="pt-4">
        <h1 className="text-[26px] font-black leading-tight tracking-[-0.02em]">프로필</h1>
        <p className="mt-1 text-sm text-muted-foreground">별명과 사진을 바꿀 수 있어요</p>
      </div>

      {loading ? (
        <div className="mt-10 flex flex-col items-center gap-6">
          <Skeleton className="size-24 rounded-full" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      ) : query.isError || !me ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">프로필을 불러오지 못했어요</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
            className="rounded-full px-6 font-semibold"
          >
            다시 시도
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-9 flex justify-center">
            <div className="relative">
              <ProfileAvatar
                avatarUrl={me.avatarUrl}
                label={me.displayName || me.email}
                className="size-24 text-[34px] ring-1 ring-foreground/10"
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={avatarSave.isPending}
                aria-label="프로필 사진 변경"
                className="absolute -bottom-1 -right-1 flex size-9 items-center justify-center rounded-full border border-input bg-secondary text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                <Camera className="size-4" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFile}
                className="hidden"
              />
            </div>
          </div>
          {avatarSave.isPending && (
            <p className="mt-3 text-center text-xs text-muted-foreground">사진 올리는 중…</p>
          )}

          <form
            className="mt-9 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSave && !nameSave.isPending) nameSave.mutate(trimmed)
            }}
          >
            <label
              htmlFor="displayName"
              className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground"
            >
              별명
            </label>
            <input
              id="displayName"
              type="text"
              value={value}
              maxLength={30}
              onChange={(e) => setName(e.target.value)}
              placeholder="별명"
              className="w-full rounded-xl border border-input bg-secondary/60 px-4 py-3 text-[15px] outline-none placeholder:text-muted-foreground/60 focus:border-foreground/20"
            />
            <Button
              type="submit"
              size="lg"
              disabled={!canSave || nameSave.isPending}
              className="mt-2 h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
            >
              {nameSave.isPending ? '저장 중…' : '저장'}
            </Button>
          </form>

          <div className="mt-9">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">계정</p>
            <p className="mt-2 text-sm text-muted-foreground">{me.email}</p>
          </div>
        </>
      )}
    </div>
  )
}
