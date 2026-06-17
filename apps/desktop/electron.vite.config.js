import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const configDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(configDir, '../..')

const bundleIntoMain = [
  '@baishou/ai',
  '@baishou/core-desktop',
  '@baishou/database-desktop',
  '@baishou/shared',
  '@baishou/store',
  '@baishou/ui',
  '@electron-toolkit/utils',
  '@electron-toolkit/preload'
]

const workspaceAliases = {
  '@baishou/ai': resolve(repoRoot, 'packages/ai'),
  '@baishou/core/shared': resolve(repoRoot, 'packages/core/src/index.shared.ts'),
  '@baishou/core-desktop': resolve(repoRoot, 'packages/core-desktop'),
  '@baishou/database-desktop': resolve(repoRoot, 'packages/database-desktop'),
  '@baishou/shared': resolve(repoRoot, 'packages/shared'),
  '@baishou/store': resolve(repoRoot, 'packages/store'),
  '@baishou/ui': resolve(repoRoot, 'packages/ui/src')
}

export default defineConfig({
  main: {
    plugins: [
      {
        name: 'resolve-workspace-subpaths',
        resolveId(id) {
          if (id === '@baishou/core/shared') {
            return workspaceAliases['@baishou/core/shared']
          }
          if (
            id === 'better-sqlite3' ||
            id.startsWith('better-sqlite3/') ||
            id === 'sqlite-vec' ||
            id.startsWith('sqlite-vec/') ||
            id === '@libsql/client' ||
            id.startsWith('@libsql/client/')
          ) {
            return { id, external: true }
          }
          return null
        }
      },
      externalizeDepsPlugin({ exclude: bundleIntoMain })
    ],
    resolve: {
      alias: workspaceAliases
    },
    ssr: {
      external: ['better-sqlite3', 'sqlite-vec', '@libsql/client']
    },
    build: {
      rollupOptions: {
        output: {
          interop: 'compat'
        },
        external: (id) => {
          if (
            id === 'electron' ||
            id === 'pdf-parse' ||
            id.includes('better-sqlite3') ||
            id.includes('sqlite-vec') ||
            id.includes('@libsql/client')
          ) {
            return true
          }
          return false
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: bundleIntoMain })],
    resolve: {
      alias: workspaceAliases
    },
    build: {
      rollupOptions: {
        output: {
          interop: 'compat'
        },
        external: ['electron', '@libsql/client']
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        react: resolve(repoRoot, 'node_modules/react'),
        'react-dom': resolve(repoRoot, 'node_modules/react-dom'),
        ...workspaceAliases
      }
    },
    plugins: [react()]
  }
})
