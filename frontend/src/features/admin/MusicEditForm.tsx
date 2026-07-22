import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MusicAdminItem, MusicAdminPatch } from './types'

/** 유튜브 영상 ID 형식 — ytimg 폴백 체인(`i.ytimg.com/vi/{id}`)의 전제(research R7). */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

interface FieldDef {
  name: keyof MusicAdminPatch
  label: string
  type: 'text' | 'date'
  placeholder?: string
}

const FIELDS: FieldDef[] = [
  { name: 'title', label: '제목', type: 'text' },
  { name: 'artist', label: '아티스트', type: 'text' },
  { name: 'album', label: '앨범', type: 'text' },
  { name: 'release_date', label: '발매일', type: 'date' },
  { name: 'youtube_video_id', label: '유튜브 영상 ID', type: 'text', placeholder: '예: jeqdYqsrsA0 (11자)' },
  { name: 'cover_url', label: '커버 이미지 링크', type: 'text', placeholder: 'https:// 로 시작하는 링크만' },
]

type FormValues = Record<keyof MusicAdminPatch, string>

function toFormValues(item: MusicAdminItem): FormValues {
  return {
    title: item.title ?? '',
    artist: item.artist ?? '',
    album: item.album ?? '',
    release_date: item.release_date ?? '',
    youtube_video_id: item.youtube_video_id ?? '',
    cover_url: item.cover_url ?? '',
  }
}

/** 데이터 모델 §2의 클라 검증 — 실패 필드가 있으면 저장을 선차단한다(FR-007·FR-010). */
function validate(values: FormValues): Partial<Record<keyof MusicAdminPatch, string>> {
  const errors: Partial<Record<keyof MusicAdminPatch, string>> = {}
  if (values.title.trim() === '') errors.title = '제목은 비워둘 수 없어요'
  else if (values.title.length > 255) errors.title = '제목은 255자 이내로 입력해주세요'
  if (values.artist.length > 255) errors.artist = '아티스트는 255자 이내로 입력해주세요'
  if (values.album.length > 255) errors.album = '앨범은 255자 이내로 입력해주세요'
  if (values.youtube_video_id !== '' && !VIDEO_ID_RE.test(values.youtube_video_id))
    errors.youtube_video_id = '영상 ID는 영문·숫자·-·_ 11자 형식이에요'
  if (values.cover_url !== '' && !/^https?:\/\//.test(values.cover_url))
    errors.cover_url = '커버는 http(s) 링크만 넣을 수 있어요'
  return errors
}

/**
 * 곡 메타 수정 폼(US2) — 변경된 필드만 PATCH로 보낸다(빈 값은 null 정규화, 계약 §3).
 * 커버는 외부 링크 문자열 입력만 — 업로드·재호스팅 UI 없음(constitution 원칙 IV).
 * 사용처에서 key={item.id}로 마운트해 곡 전환 시 폼이 초기화되게 한다.
 */
export function MusicEditForm({
  item,
  pending,
  onSubmit,
}: {
  item: MusicAdminItem
  pending: boolean
  onSubmit: (patch: MusicAdminPatch) => void
}) {
  const initial = useMemo(() => toFormValues(item), [item])
  const [values, setValues] = useState<FormValues>(initial)
  const [errors, setErrors] = useState<Partial<Record<keyof MusicAdminPatch, string>>>({})

  const dirty = (Object.keys(values) as (keyof MusicAdminPatch)[]).filter((k) => values[k] !== initial[k])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0 || dirty.length === 0) return
    // 계약 §3 — 담긴(변경된) 필드만, 빈 문자열은 null로
    const patch: MusicAdminPatch = {}
    for (const k of dirty) {
      const v = values[k].trim()
      if (k === 'title') patch.title = v
      else patch[k] = v === '' ? null : v
    }
    onSubmit(patch)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div className="rounded-xl bg-white/4 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          id <span className="font-semibold text-foreground/80">{item.id}</span> · 출처{' '}
          <span className="font-semibold text-foreground/80">{item.source}</span>
        </p>
        <p className="truncate">acrid {item.acrid ?? '—'}</p>
      </div>

      {FIELDS.map((field) => (
        <label key={field.name} className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted-foreground">{field.label}</span>
          <input
            type={field.type}
            value={values[field.name]}
            placeholder={field.placeholder}
            disabled={pending}
            onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            className={cn(
              'h-10 rounded-xl border bg-white/4 px-3 text-sm font-medium outline-none transition-colors',
              'placeholder:text-muted-foreground/60 focus:border-ring/60',
              errors[field.name] ? 'border-destructive/60' : 'border-white/10',
            )}
          />
          {errors[field.name] && <span className="text-[11px] font-medium text-destructive">{errors[field.name]}</span>}
        </label>
      ))}

      <Button
        type="submit"
        disabled={pending || dirty.length === 0}
        className="mt-1 h-11 rounded-full text-sm font-bold"
      >
        {pending ? '저장 중…' : dirty.length === 0 ? '변경 사항 없음' : '저장'}
      </Button>
    </form>
  )
}
