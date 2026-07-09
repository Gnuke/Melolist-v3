import type { ComponentType, ReactNode } from 'react'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface FailureAction {
  label: ReactNode
  onClick: () => void
  primary?: boolean
}

interface Props {
  icon: ComponentType<{ className?: string }>
  /** 아이콘 원의 톤 — F1=warning(품질), F2=중립, F4·마이크=danger */
  tone: 'warning' | 'neutral' | 'danger'
  title: string
  body: string
  actions: FailureAction[]
}

const toneClass: Record<Props['tone'], string> = {
  warning: 'bg-warning/15 text-warning',
  neutral: 'bg-secondary text-muted-foreground',
  danger: 'bg-destructive/15 text-destructive',
}

/**
 * 실패 UX 공통 레이아웃(1k) — 아이콘·카피·CTA만 유형별로 분기(F1~F4).
 * raw 에러 메시지는 절대 렌더하지 않는다(C4).
 */
export function FailureView({ icon: Icon, tone, title, body, actions }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-1 flex-col items-center justify-center gap-8 py-10 text-center"
    >
      <div className="flex flex-col items-center gap-5">
        <div className={cn('flex size-16 items-center justify-center rounded-full', toneClass[tone])}>
          <Icon className="size-7" />
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-[19px] font-extrabold tracking-tight">{title}</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2.5">
        {actions.map((a, i) => (
          <Button
            key={i}
            type="button"
            onClick={a.onClick}
            variant={a.primary ? 'default' : 'outline'}
            size="lg"
            className="h-12 w-full rounded-full text-[15px] font-bold transition-transform active:scale-[0.97]"
          >
            {a.label}
          </Button>
        ))}
      </div>
    </motion.div>
  )
}
