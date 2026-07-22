import { useState } from 'react'
import { Navigate, useOutletContext } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { fetchAdminUsers, isAdminAuthError, updateAdminUserRole } from '@/features/admin/api'
import type { AdminOutletContext } from '@/pages/admin/AdminLayout'
import type { AdminRole, PageResponse, UserAdminItem } from '@/features/admin/types'

const PAGE_SIZE = 20

/**
 * US3 사용자·권한 관리 — 목록 조회 + 관리자 역할 부여/해제.
 * 자기 자신의 ADMIN 해제는 클라에서 선차단(버튼 비활성 — FR-008, 서버 409는 이중 방어).
 * 개별 사용자의 사적 데이터(기록·즐겨찾기 내용)는 표시하지 않는다(FR-011).
 */
export function AdminUsersPage() {
  const { meId } = useOutletContext<AdminOutletContext>()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(0)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const params = { page, size: PAGE_SIZE }
  const queryKey = ['admin', 'users', params] as const

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAdminUsers(params),
    placeholderData: keepPreviousData,
  })

  const roleUpdate = useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) => updateAdminUserRole(id, role),
    onSuccess: (saved) => {
      queryClient.setQueryData<PageResponse<UserAdminItem>>(queryKey, (data) =>
        data && { ...data, items: data.items.map((u) => (u.id === saved.id ? saved : u)) },
      )
      setConfirmId(null)
      toast(saved.role === 'ADMIN' ? '관리자 역할을 부여했어요' : '관리자 역할을 해제했어요')
    },
    onError: (err) => {
      setConfirmId(null)
      if (!isAdminAuthError(err)) toast('역할을 변경하지 못했어요 — 잠시 후 다시 시도해주세요')
    },
  })

  if (
    (query.isError && isAdminAuthError(query.error)) ||
    (roleUpdate.isError && isAdminAuthError(roleUpdate.error))
  ) {
    return <Navigate to="/" replace />
  }

  const data = query.data
  const items = data?.items ?? []

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-extrabold tracking-tight">사용자</h2>
        {data && (
          <p className="text-[13px] font-semibold text-muted-foreground">총 {data.total_items.toLocaleString()}명</p>
        )}
      </div>

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/7 bg-card/60 py-16 text-center">
          <p className="text-sm text-muted-foreground">목록을 불러오지 못했어요</p>
          <Button type="button" variant="outline" onClick={() => query.refetch()} className="rounded-full px-6 font-semibold">
            다시 시도
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-white/7 bg-card/60 py-16 text-center text-sm text-muted-foreground">
          아직 가입한 사용자가 없어요
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {items.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                isMe={u.id === meId}
                confirming={confirmId === u.id}
                pending={roleUpdate.isPending && roleUpdate.variables?.id === u.id}
                onAskConfirm={() => setConfirmId(u.id)}
                onCancel={() => setConfirmId(null)}
                onConfirm={(role) => roleUpdate.mutate({ id: u.id, role })}
              />
            ))}
          </ul>

          {data && data.total_pages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 0 || query.isFetching}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-full px-4 font-semibold"
              >
                이전
              </Button>
              <span className="text-[13px] font-semibold text-muted-foreground tabular-nums">
                {page + 1} / {data.total_pages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page + 1 >= data.total_pages || query.isFetching}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-full px-4 font-semibold"
              >
                다음
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function UserRow({
  u,
  isMe,
  confirming,
  pending,
  onAskConfirm,
  onCancel,
  onConfirm,
}: {
  u: UserAdminItem
  isMe: boolean
  confirming: boolean
  pending: boolean
  onAskConfirm: () => void
  onCancel: () => void
  onConfirm: (role: AdminRole) => void
}) {
  const nextRole: AdminRole = u.role === 'ADMIN' ? 'USER' : 'ADMIN'
  const selfDemotion = isMe && u.role === 'ADMIN'
  const joined = new Date(u.created_at).toLocaleDateString('ko-KR')

  return (
    <li className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-white/7 bg-card/60 p-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-bold">
            {u.display_name ?? '(별명 없음)'}
            {isMe && <span className="ml-1.5 text-[12px] font-semibold text-muted-foreground">— 나</span>}
          </p>
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold',
              u.role === 'ADMIN' ? 'bg-success/15 text-success' : 'bg-white/6 text-muted-foreground',
            )}
          >
            {u.role === 'ADMIN' && <ShieldCheck className="size-3" />}
            {u.role}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
          {u.email} · 가입 {joined}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {selfDemotion ? (
          <p className="text-[11px] font-medium text-muted-foreground">자기 자신의 관리자 역할은 해제할 수 없어요</p>
        ) : confirming ? (
          <>
            <span className="text-[12px] font-semibold text-muted-foreground">
              {nextRole === 'ADMIN' ? '관리자로 지정할까요?' : '관리자를 해제할까요?'}
            </span>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => onConfirm(nextRole)}
              className="h-8 rounded-full px-4 text-[12px] font-bold"
            >
              {pending ? '변경 중…' : '확인'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={onCancel}
              className="h-8 rounded-full px-3 text-[12px] font-semibold text-muted-foreground"
            >
              취소
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAskConfirm}
            className="h-8 rounded-full px-4 text-[12px] font-semibold"
          >
            {nextRole === 'ADMIN' ? '관리자 지정' : '관리자 해제'}
          </Button>
        )}
      </div>
    </li>
  )
}
