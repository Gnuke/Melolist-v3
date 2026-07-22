import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'
import type { PlaylistFormValues } from './api'

interface Props {
  open: boolean
  onClose: () => void
  /** 수정이면 기존 값, 생성이면 null */
  initial: PlaylistFormValues | null
  pending: boolean
  onSubmit: (values: PlaylistFormValues) => void
}

const TITLE_MAX = 120

/** 플레이리스트 생성·정보 수정 공용 폼 시트 — 제목(필수)·설명·공개 여부. */
export function PlaylistFormSheet({ open, onClose, initial, pending, onSubmit }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  // 열릴 때마다 초기값으로 리셋 — 닫았다 다시 열면 이전 입력이 남지 않는다
  useEffect(() => {
    if (!open) return
    setTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
    setIsPublic(initial?.is_public ?? false)
  }, [open, initial])

  const valid = title.trim().length > 0

  return (
    <BottomSheet open={open} onClose={pending ? () => undefined : onClose}>
      <h2 className="text-[17px] font-extrabold tracking-tight">
        {initial ? '플레이리스트 수정' : '새 플레이리스트'}
      </h2>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid || pending) return
          onSubmit({ title: title.trim(), description: description.trim(), is_public: isPublic })
        }}
        className="mt-4 flex flex-col gap-3"
      >
        <input
          type="text"
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (예: 출근길 플레이리스트)"
          autoFocus
          className="w-full rounded-xl border border-input bg-secondary/60 px-4 py-3 text-[15px] outline-none placeholder:text-muted-foreground/60 focus:border-foreground/20"
        />
        <textarea
          value={description}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          className="w-full resize-none rounded-xl border border-input bg-secondary/60 px-4 py-3 text-[15px] outline-none placeholder:text-muted-foreground/60 focus:border-foreground/20"
        />

        <label className="flex items-center justify-between rounded-xl border border-border bg-card/60 px-4 py-3">
          <span>
            <span className="block text-[15px] font-semibold">공개 플레이리스트</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">링크가 있는 누구나 볼 수 있어요</span>
          </span>
          {/* 스위치 on은 뉴트럴 전경색 — flame은 아래 저장 버튼(뷰당 주 액션 1개, DS §10) */}
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-label="공개 여부"
            onClick={() => setIsPublic((v) => !v)}
            className={cn(
              'relative h-7 w-12 shrink-0 rounded-full transition-colors',
              isPublic ? 'bg-foreground' : 'bg-input',
            )}
          >
            <span
              className={cn(
                'absolute top-1 size-5 rounded-full bg-background transition-all',
                isPublic ? 'left-6' : 'left-1',
              )}
            />
          </button>
        </label>

        <Button
          type="submit"
          size="lg"
          disabled={!valid || pending}
          className="mt-2 h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
        >
          {pending ? '저장 중…' : initial ? '저장' : '만들기'}
        </Button>
      </form>
    </BottomSheet>
  )
}
