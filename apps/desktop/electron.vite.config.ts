import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

import pkg from './package.json'

const workspaceAliases = {
  '@baishou/ai': resolve('../../packages/ai'),
  '@baishou/core': resolve('../../packages/core'),
  '@baishou/database': resolve('../../packages/database'),
  '@baishou/shared': resolve('../../packages/shared'),
  '@baishou/store': resolve('../../packages/store'),
  '@baishou/ui': resolve('../../packages/ui')
}

const workspaceExcludes = [
  '@baishou/ai', '@baishou/core', '@baishou/database', 
  '@baishou/shared', '@baishou/store', '@baishou/ui'
]

export default defineConfig({
  main: {
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
        ...workspaceAliases
      }
    },
    plugins: [react()]
  }
})
