import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/dist/**', '**/node_modules/**'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped'
      }
    }
  }
})
