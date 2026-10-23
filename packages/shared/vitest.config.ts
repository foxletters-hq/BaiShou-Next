import { defineConfig } from 'vitest/config'

const isWinOrWsl =
  process.platform === 'win32' || Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP)

export default defineConfig({
  test: {
    maxWorkers: isWinOrWsl ? 2 : undefined,
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
})
