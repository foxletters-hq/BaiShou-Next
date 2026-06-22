import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '../assets/diary-editor')
const sharedDiaryCm = path.resolve(
  __dirname,
  '../../../packages/ui/src/shared/diary-codemirror'
)

/** WebView 内联 CM bundle：IIFE 单文件，target 兼容 Android System WebView / WKWebView */
export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@baishou/ui/shared/diary-codemirror': sharedDiaryCm
    }
  },
  build: {
    outDir,
    emptyOutDir: false,
    target: 'es2020',
    minify: 'esbuild',
    sourcemap: false,
    lib: {
      entry: path.resolve(__dirname, 'src/main.ts'),
      name: 'DiaryEditorBundle',
      formats: ['iife'],
      fileName: () => 'diary-editor.bundle'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
})
