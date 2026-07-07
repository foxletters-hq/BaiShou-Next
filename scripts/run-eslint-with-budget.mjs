#!/usr/bin/env node
/**
 * 按 lint-warning-baseline.json 跑 ESLint：error 必为零，warning 不得超过基线。
 * 用法：node scripts/run-eslint-with-budget.mjs desktop|mobile
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const app = process.argv[2]
if (app !== 'desktop' && app !== 'mobile') {
  console.error('用法: node scripts/run-eslint-with-budget.mjs <desktop|mobile>')
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, 'scripts', 'lint-warning-baseline.json')
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const maxWarnings = baseline[app]
if (typeof maxWarnings !== 'number') {
  console.error(`[lint] 基线缺少 ${app} 的 warning 上限: ${baselinePath}`)
  process.exit(1)
}

const cwd = join(root, 'apps', app)
const eslintArgs = ['exec', 'eslint', '--cache', '.', `--max-warnings=${maxWarnings}`]

console.log(`[lint:${app}] ESLint（warning 上限 ${maxWarnings}，见 scripts/lint-warning-baseline.json）`)

const result = spawnSync('pnpm', eslintArgs, { cwd, stdio: 'inherit' })
process.exit(result.status === null ? 1 : result.status)
