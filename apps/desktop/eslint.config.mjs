import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import { createBaishouEslintConfig } from '../../eslint.baishou.base.mjs'
import portalClipRule from '../../scripts/eslint-plugin-ui-theme.mjs'

export default [
  ...createBaishouEslintConfig({
    extraIgnores: ['electron.vite.config.*', 'eslint.config.mjs'],
    extraPlugins: {
      'react-refresh': eslintPluginReactRefresh,
      'ui-theme': {
        rules: {
          'portal-must-clip-to-content-card': portalClipRule
        }
      }
    },
    extraRules: {
      ...eslintPluginReactRefresh.configs.vite.rules,
      'react-refresh/only-export-components': 'off',
      'ui-theme/portal-must-clip-to-content-card': 'error'
    }
  }),
  {
    files: ['src/main/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    // 开关与勾选框只允许用 @baishou/ui 的实现，页面里不得再画一份
    files: ['src/renderer/**/*.tsx'],
    ignores: ['**/__tests__/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="type"][value.value="checkbox"]',
          message:
            '请从 @baishou/ui 引入 Checkbox 或 Switch，不要在页面里写原生 checkbox。见 packages/ui/COMPONENTS.md。'
        },
        {
          selector:
            'JSXAttribute[name.name="type"] > JSXExpressionContainer > Literal[value="checkbox"]',
          message:
            '请从 @baishou/ui 引入 Checkbox 或 Switch，不要在页面里写原生 checkbox。见 packages/ui/COMPONENTS.md。'
        }
      ]
    }
  }
]
