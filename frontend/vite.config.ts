import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // '@/...' → src/... (shadcn/ui 및 도메인 임포트용)
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
