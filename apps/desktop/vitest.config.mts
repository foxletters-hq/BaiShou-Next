import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const configDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(configDir, '../..')

const workspaceAliases = {
  '@baishou/ai': resolve(repoRoot, 'packages/ai'),
  '@baishou/core/shared': resolve(repoRoot, 'packages/core/src/index.shared.ts'),
  '@baishou/core-desktop': resolve(repoRoot, 'packages/core-desktop'),
  '@baishou/database-desktop': resolve(repoRoot, 'packages/database-desktop'),
  '@baishou/shared/cache': resolve(repoRoot, 'packages/shared/src/cache/index.ts'),
  '@baishou/shared': resolve(repoRoot, 'packages/shared'),
  '@baishou/store': resolve(repoRoot, 'packages/store'),
  '@baishou/ui': resolve(repoRoot, 'packages/ui/src')
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: workspaceAliases
  },
  test: {
    pool: 'threads',
    maxWorkers: process.platform === 'win32' ? 2 : undefined,
    fileParallelism: process.platform !== 'win32',
    // ci:check 下 turbo 并行跑所有包测试，冷启动动态 import 在高负载时可能超过默认 5s
    testTimeout: 30000,
    hookTimeout: 30000,
    environment: 'jsdom',
    environmentMatchGlobs: [['src/main/**', 'node']],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped'
      }
    }
  }
})
