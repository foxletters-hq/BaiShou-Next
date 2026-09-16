#!/usr/bin/env node
/**
 * 按 lint-warning-baseline.json 跑 ESLint：error 必为零，warning 不得超过基线。
 * 用法：node scripts/run-eslint-with-budget.mjs <工作区>，可选值见 scripts/lint-targets.mjs
 *
 * 直接调用 ESLint CLI（不经 pnpm exec），避免 Windows 下 spawn/pnpm 兼容问题。
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINT_TARGETS } from './lint-targets.mjs'

const target = process.argv[2]
const targetDir = LINT_TARGETS[target]
if (!targetDir) {
  console.error(
    `用法: node scripts/run-eslint-with-budget.mjs <${Object.keys(LINT_TARGETS).join('|')}>`
  )
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, 'scripts', 'lint-warning-baseline.json')
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const maxWarnings = baseline[target]
if (typeof maxWarnings !== 'number') {
  console.error(`[lint] 基线缺少 ${target} 的 warning 上限: ${baselinePath}`)
  process.exit(1)
}

const require = createRequire(import.meta.url)
const eslintCli = join(dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js')
const cwd = join(root, targetDir)

console.log(
  `[lint:${target}] ESLint（warning 上限 ${maxWarnings}，见 scripts/lint-warning-baseline.json）`
)

const result = spawnSync(
  process.execPath,
  [eslintCli, '--cache', '.', `--max-warnings=${maxWarnings}`],
  { cwd, stdio: 'inherit' }
)
process.exit(result.status === null ? 1 : result.status)
