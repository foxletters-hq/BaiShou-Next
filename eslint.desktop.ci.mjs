/**
 * CI 用 Desktop ESLint（renderer 未使用变量暂为 warn，--quiet 不阻断）
 * 用法：pnpm --filter @baishou/desktop exec eslint -c ../../eslint.desktop.ci.mjs . --cache --quiet
 */
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import { createBaishouEslintConfig } from './eslint.baishou.base.mjs'

export default [
  ...createBaishouEslintConfig({
    extraIgnores: ['electron.vite.config.*', 'eslint.config.mjs'],
    extraPlugins: {
      'react-refresh': eslintPluginReactRefresh
    },
    extraRules: {
      ...eslintPluginReactRefresh.configs.vite.rules,
      'react-refresh/only-export-components': 'off'
    }
  }),
  {
    files: ['src/main/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn'
    }
  }
]
