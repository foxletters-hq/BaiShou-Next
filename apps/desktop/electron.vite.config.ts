import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const workspaceAliases = {
  '@baishou/ai': resolve('../../packages/ai'),
  '@baishou/core-desktop': resolve('../../packages/core-desktop'),
  '@baishou/database-desktop': resolve('../../packages/database-desktop'),
  '@baishou/shared': resolve('../../packages/shared'),
  '@baishou/store': resolve('../../packages/store'),
  '@baishou/ui': resolve('../../packages/ui/src')
}

const workspaceExcludes = [
  '@baishou/ai',
  '@baishou/core-desktop',
  '@baishou/database-desktop',
  '@baishou/shared',
  '@baishou/store',
  '@baishou/ui'
]

export default defineConfig({
  main: {
    plugins: [
      {
        name: 'force-external',
        resolveId(id) {
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
      externalizeDepsPlugin({ exclude: workspaceExcludes })
    ],
    resolve: {
      alias: workspaceAliases
    },
    ssr: {
      external: ['better-sqlite3', 'sqlite-vec', '@libsql/client']
    },
    build: {
      rollupOptions: {
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
    plugins: [externalizeDepsPlugin({ exclude: workspaceExcludes })],
    resolve: {
      alias: workspaceAliases
    },
    build: {
      rollupOptions: {
        external: ['electron', '@libsql/client']
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        react: resolve('node_modules/react'),
        'react-dom': resolve('node_modules/react-dom'),
        ...workspaceAliases
      }
    },
    plugins: [react()]
  }
})
