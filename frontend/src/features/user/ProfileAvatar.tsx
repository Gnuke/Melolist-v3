import { cn } from '@/lib/utils'

interface Props {
  avatarUrl: string | null | undefined
  label: string
  /** 크기 계열 클래스 — 지름과 이니셜 글자 크기 (예: "size-7 text-[12px]") */
  className?: string
}

/**
 * 프로필 아바타 공용 렌더(ProfileCorner 칩·ProfileSheet·ProfilePage).
 * 사진 URL이 있으면 은은한 원 배경 위에 이미지를 얹는다 — 이미지 로드 전에도
 * 이니셜을 보여주지 않아 "이니셜→실사진" 교체 깜빡임이 없다. 이니셜은 URL이 없을 때만.
 */
export function ProfileAvatar({ avatarUrl, label, className }: Props) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-iris/15 font-bold text-iris-soft',
        className,
      )}
    >
      {avatarUrl ? (
        // Google 프로필 이미지는 referrer 있으면 403이 나는 경우가 있음
        <img
          src={avatarUrl}
          alt={label}
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <span aria-hidden>{(label[0] ?? '?').toUpperCase()}</span>
      )}
    </span>
  )
}
