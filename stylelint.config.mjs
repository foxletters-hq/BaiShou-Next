/**
 * 只配一条规则：不允许在业务样式里重新实现开关与勾选框。
 *
 * 开关与勾选框的唯一实现是 packages/ui 的 Switch 与 Checkbox 组件。自制开关的标志是
 * 给原生 checkbox 定制外观，也就是选择器里出现 :checked 或 [type=checkbox]。
 *
 * 这一层拦 CSS，ESLint 拦 JSX 里的 <input type="checkbox">，两者合起来才没有缺口：
 * 光有 ESLint 时，把开关样式写在 .css 里、JSX 只留 className 的写法照样能通过检查。
 *
 * 这里不启用任何推荐规则集。代码格式由 Prettier 负责，这份配置只管组件治理。
 */

const MESSAGE =
  '请从 @baishou/ui 引入 Switch 或 Checkbox，不要在样式里重新实现开关。见 packages/ui/COMPONENTS.md。'

export default {
  ignoreFiles: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/out/**'],
  rules: {
    'selector-disallowed-list': [[/:checked/, /\[type=['"]?checkbox/], { message: MESSAGE }]
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
