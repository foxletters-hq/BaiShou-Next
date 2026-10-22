import { defineConfig, configDefaults } from 'vitest/config'

const isWinOrWsl =
  process.platform === 'win32' || Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP)

export default defineConfig({
  test: {
    maxWorkers: isWinOrWsl ? 2 : undefined,
    globals: true,
    environment: 'node',
    exclude: [
      ...configDefaults.exclude,
      'src/__tests__/schema.test.ts',
      'src/repositories/__tests__/assistant.repository.test.ts',
      'src/repositories/__tests__/prompt-shortcut.repository.test.ts',
      'src/repositories/__tests__/settings.repository.test.ts',
      'src/repositories/__tests__/user-profile.repository.test.ts',
      'src/repositories/__tests__/memory.repository.test.ts',
      'src/repositories/__tests__/summary.repository.impl.test.ts'
    ]
  }
})
