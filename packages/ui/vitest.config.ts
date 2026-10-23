import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

const isWinOrWsl =
  process.platform === 'win32' || Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'src/test-utils/react-native-vitest-mock.ts')
    }
  },
  test: {
    maxWorkers: isWinOrWsl ? 2 : undefined,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['**/dist/**', '**/node_modules/**'],
    css: {
      modules: {
        classNameStrategy: 'non-scoped'
      }
    },
    server: {
      deps: {
        inline: ['codemirror-markdown-tables', '@mobily/ts-belt', '@floating-ui/dom']
      }
    }
  }
})
