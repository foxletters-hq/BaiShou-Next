import { createBaishouEslintConfig } from '../../eslint.baishou.base.mjs'

export default [
  ...createBaishouEslintConfig({
    extraIgnores: [
      '.expo/**',
      'android/**',
      'ios/**',
      'modules/**',
      'scripts/**',
      'mocks/**',
      'metro.config.js',
      'polyfill.js',
      'eslint.config.mjs',
      'eslint.config.js'
    ]
  }),
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
]
