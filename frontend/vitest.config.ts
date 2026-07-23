import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// vite.config.ts와 별도인 이유: tailwindcss 플러그인 등 빌드 전용 설정을
// 테스트 러너에 끌고 오지 않기 위함. alias만 동일하게 유지한다.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
  },
})
