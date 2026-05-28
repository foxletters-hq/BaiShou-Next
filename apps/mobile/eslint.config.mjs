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
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'electron',
              message: 'Electron 仅用于 apps/desktop，移动端请使用 Expo 能力。'
            },
            {
              name: 'better-sqlite3',
              message: 'better-sqlite3 仅用于桌面端，移动端使用 @baishou/database（expo-sqlite）。'
            },
            {
              name: '@baishou/core-desktop',
              message: '桌面专用包，移动端请使用 @baishou/core-mobile。'
            },
            {
              name: '@baishou/database-desktop',
              message: '桌面专用包，移动端请使用 @baishou/database 或 @baishou/database/expo。'
            },
            {
              name: '@baishou/core',
              message: '请使用 @baishou/core-mobile，避免拉入桌面 Git/导入模块。'
            }
          ],
          patterns: [
            {
              group: [
                '@baishou/database/desktop',
                '@baishou/core/desktop',
                '@baishou/database/src/index.desktop',
                '@baishou/database/src/drivers/node-sqlite*',
                '@baishou/database/src/connection.manager*'
              ],
              message: '请使用 @baishou/database 或 @baishou/database/expo，不要引用桌面数据库入口。'
            },
            {
              group: ['@baishou/ui/src/web/**', '@baishou/ui/web/**'],
              message: '请使用 @baishou/ui/native，不要引用 Web 组件。'
            }
          ]
        }
      ]
    }
  }
]
