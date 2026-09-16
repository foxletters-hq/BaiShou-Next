/**
 * 需要跑 ESLint 的工作区，键名同时用作 lint-warning-baseline.json 的 key。
 *
 * run-eslint-with-budget.mjs 与 print-lint-warning-baseline.mjs 共用这一份，
 * 避免新增工作区时只改了一边。
 */
export const LINT_TARGETS = {
  desktop: 'apps/desktop',
  mobile: 'apps/mobile',
  ui: 'packages/ui'
}
