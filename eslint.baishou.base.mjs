/**
 * 白守 monorepo 共享 ESLint 配置（desktop / mobile 共用）
 * 避免 eslint-plugin-react recommended 与 ESLint 10 不兼容，统一 TS + Hooks + i18n 规则
 */
import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import i18nChineseRule from './scripts/eslint-plugin-i18n-chinese.mjs'

const sharedIgnores = [
  '**/node_modules',
  '**/dist',
  '**/out',
  '**/*.d.ts',
  '**/.turbo',
  '**/build',
  '**/coverage'
]

/**
 * @param {object} options
 * @param {string[]} [options.extraIgnores]
 * @param {Record<string, unknown>} [options.extraPlugins]
 * @param {Record<string, unknown>} [options.extraRules]
 */
export function createBaishouEslintConfig(options = {}) {
  const { extraIgnores = [], extraPlugins = {}, extraRules = {} } = options

  return defineConfig(
    {
      ignores: [...sharedIgnores, ...extraIgnores]
    },
    tseslint.configs.recommended,
    {
      settings: {
        react: {
          version: 'detect'
        }
      }
    },
    {
      files: ['**/*.{ts,tsx}'],
      plugins: {
        'react-hooks': eslintPluginReactHooks,
        'i18n-chinese': {
          rules: {
            'no-hardcoded-chinese': i18nChineseRule
          }
        },
        ...extraPlugins
      },
      rules: {
        ...eslintPluginReactHooks.configs.recommended.rules,
        'react-hooks/set-state-in-effect': 'off',
        'react-hooks/refs': 'off',
        'react-hooks/static-components': 'off',
        'react-hooks/immutability': 'off',
        'react-hooks/purity': 'off',
        'react-hooks/preserve-manual-memoization': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/no-unsafe-function-type': 'off',
        'no-useless-catch': 'off',
        'no-async-promise-executor': 'off',
        'no-useless-escape': 'off',
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_',
            caughtErrors: 'none'
          }
        ],
        'no-empty': ['error', { allowEmptyCatch: true }],
        'i18n-chinese/no-hardcoded-chinese': 'warn',
        'max-lines': [
          'warn',
          {
            max: 500,
            skipBlankLines: true,
            skipComments: true
          }
        ],
        ...extraRules
      }
    },
    eslintConfigPrettier
  )
}
