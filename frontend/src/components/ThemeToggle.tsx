import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setTheme, useTheme } from '@/lib/theme'

/**
 * 헤더 공용 테마 토글 — 프로필 화면 전용이던 화면 테마 설정을 게스트 포함
 * 전 탭 화면에서 쓸 수 있게 승격. 아이콘은 "누르면 바뀔 모드"를 보여준다
 * (다크 중엔 해, 라이트 중엔 달).
 */
export function ThemeToggle() {
  const theme = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next)}
      aria-label={next === 'light' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      className="rounded-full text-muted-foreground hover:text-foreground"
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  )
}
