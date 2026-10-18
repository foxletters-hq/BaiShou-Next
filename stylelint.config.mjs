/**
 * 组件与主题治理，不启用推荐格式规则（格式由 Prettier 负责）。
 *
 * 1. 开关 / 勾选框：不允许在业务样式里重新实现。自制开关的标志是选择器里出现
 *    :checked 或 [type=checkbox]。这一层拦 CSS，ESLint 拦 JSX 里的
 *    <input type="checkbox">。只有 ESLint 时，把开关样式写在 .css 里、JSX 只留
 *    className 的写法照样能通过检查。
 *
 * 2. 字号：不允许在业务 CSS 写死 px/pt/rem。桌面用 --ui-fs-* / --settings-font-*，
 *    移动相关 CSS 用 --mobile-fs-*。相对单位 em/%/inherit 放行。本条为 warning：
 *    `pnpm lint:css` 会列出存量，目前不阻断 CI。
 */

const MESSAGE =
  '请从 @baishou/ui 引入 Switch 或 Checkbox，不要在样式里重新实现开关。见 packages/ui/COMPONENTS.md。'

const FONT_SIZE_MESSAGE =
  '不要写死 font-size 像素。桌面用 var(--ui-fs-*) 或 var(--settings-font-*)，移动相关 CSS 用 var(--mobile-fs-*)。相对单位 em/%/inherit 和图标字号除外。见 docs/1-AI-Code/2-UI-Theme-Rule.md §3.3a / §3.9。'

export default {
  ignoreFiles: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/out/**'],
  rules: {
    'selector-disallowed-list': [[/:checked/, /\[type=['"]?checkbox/], { message: MESSAGE }],
    'declaration-property-value-disallowed-list': [
      {
        'font-size': ['/\\d+(?:\\.\\d+)?px/', '/\\d+(?:\\.\\d+)?pt/', '/\\d+(?:\\.\\d+)?rem/']
      },
      { message: FONT_SIZE_MESSAGE, severity: 'warning' }
    ]
  },
  overrides: [
    {
      // 这两处是开关与勾选框的实现本身，form-field.css 是主题层的表单字段基础样式
      files: [
        'packages/ui/src/desktop/Switch/**/*.css',
        'packages/ui/src/desktop/Checkbox/**/*.css',
        'packages/ui/src/theme/form-field.css'
      ],
      rules: { 'selector-disallowed-list': null }
    }
  ]
}
