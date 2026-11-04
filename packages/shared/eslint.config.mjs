import { createBaishouEslintConfig } from '../../eslint.baishou.base.mjs'
import jsonParser from '../../scripts/eslint-parser-json.mjs'

export default [
  ...createBaishouEslintConfig({
    extraIgnores: ['**/*.mjs', '**/*.mts', 'vitest.config.ts', 'vitest.setup.ts']
  }),
  {
    // i18n 资源文件（按领域拆分的 JSON 片段）：严格 ≤ 500 行，零容忍
    files: ['src/i18n/**/*.json'],
    languageOptions: {
      parser: jsonParser
    },
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-unused-expressions': 'off',
      'max-lines': [
        'error',
        {
          max: 500,
          skipBlankLines: true,
          skipComments: true
        }
      ]
    }
  },
  {
    // i18n 代码与目录合并入口：严格 ≤ 500 行
    files: ['src/i18n/**/*.{ts,tsx}'],
    rules: {
      'i18n-chinese/no-hardcoded-chinese': 'off',
      'max-lines': [
        'error',
        {
          max: 500,
          skipBlankLines: true,
          skipComments: true
        }
      ]
    }
  },
  {
    // shared 包其他历史非 UI 模块：放宽中文与控制字符正则检测
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/i18n/**'],
    rules: {
      'i18n-chinese/no-hardcoded-chinese': 'off',
      'no-control-regex': 'off'
    }
  }
]
