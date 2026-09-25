import { createBaishouEslintConfig } from '../../eslint.baishou.base.mjs'
import portalClipRule from '../../scripts/eslint-plugin-ui-theme.mjs'

const NO_NATIVE_CHECKBOX =
  '开关与勾选框的唯一实现是本包的 Switch / Checkbox，其他地方不要写原生 checkbox。见 packages/ui/COMPONENTS.md。'

export default [
  ...createBaishouEslintConfig({
    // .mjs 是构建期脚本，不走组件的类型与 hooks 规则
    extraIgnores: ['**/*.mjs', '**/*.generated.ts', 'vitest.config.ts', 'vitest.setup.ts'],
    extraPlugins: {
      'ui-theme': {
        rules: {
          'portal-must-clip-to-content-card': portalClipRule
        }
      }
    },
    extraRules: {
      'ui-theme/portal-must-clip-to-content-card': 'error'
    }
  }),
  {
    // 移动端用 require() 引静态资源（图片、字体），这是 React Native 的常规写法
    files: ['src/native/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    files: ['src/**/*.tsx'],
    ignores: [
      '**/__tests__/**',
      'src/desktop/Checkbox/Checkbox.tsx',
      'src/desktop/Switch/Switch.tsx'
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXAttribute[name.name="type"][value.value="checkbox"]',
          message: NO_NATIVE_CHECKBOX
        },
        {
          selector:
            'JSXAttribute[name.name="type"] > JSXExpressionContainer > Literal[value="checkbox"]',
          message: NO_NATIVE_CHECKBOX
        }
      ]
    }
  },
  {
    files: ['src/native/**/*.{ts,tsx}'],
    ignores: ['**/__tests__/**', 'src/native/Switch/**', 'src/native/Checkbox/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['Switch', 'Checkbox'],
              message:
                '请使用本包 src/native 下的 Switch 或 Checkbox，不要用 react-native 自带的。见 packages/ui/COMPONENTS.md。'
            }
          ]
        }
      ]
    }
  }
]
