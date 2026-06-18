import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(rootDir, '../..')

export default defineConfig({
  resolve: {
    alias: {
      '@baishou/core/shared': path.resolve(repoRoot, 'packages/core/src/index.shared.ts'),
      expo: path.resolve(rootDir, 'src/test-stubs/expo.ts'),
      'expo-sqlite': path.resolve(rootDir, 'src/test-stubs/expo-sqlite.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.ts']
  }
})
