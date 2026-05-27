/**
 * CI / 本地 mobile lint 用配置（不依赖 apps/mobile/eslint.config.mjs 是否可写）
 * 用法：pnpm --filter @baishou/mobile exec eslint -c ../../eslint.mobile.ci.mjs . --cache --quiet
 */
import { createBaishouEslintConfig } from './eslint.baishou.base.mjs'

export default [
  ...createBaishouEslintConfig({
    extraRules: {
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-empty': ['warn', { allowEmptyCatch: true }]
    },
    extraIgnores: ['.expo/**', 'scripts/**', 'mocks/**', 'metro.config.js', 'polyfill.js']
  }),
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
]
