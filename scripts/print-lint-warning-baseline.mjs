#!/usr/bin/env node
/**
 * 统计各工作区当前 ESLint warning 数，便于下调 lint-warning-baseline.json。
 * 工作区清单见 scripts/lint-targets.mjs。直接调用 ESLint CLI（不经 pnpm exec）。
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINT_TARGETS } from './lint-targets.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, 'scripts', 'lint-warning-baseline.json')
const require = createRequire(import.meta.url)
const eslintCli = join(dirname(require.resolve('eslint/package.json')), 'bin', 'eslint.js')

/** @param {keyof typeof LINT_TARGETS} target */
function countWarnings(target) {
  const outFile = join(root, `.lint-count-${target}.json`)
  const cwd = join(root, LINT_TARGETS[target])
  const result = spawnSync(process.execPath, [eslintCli, '.', '-f', 'json', '-o', outFile], {
    cwd,
    encoding: 'utf8'
  })
  if (result.status !== 0 && result.status !== 1) {
    console.error(`[lint:baseline] ${target} eslint 失败`)
    process.exit(result.status ?? 1)
  }
  const reports = JSON.parse(readFileSync(outFile, 'utf8'))
  const warnings = reports.reduce((sum, file) => sum + file.warningCount, 0)
  const errors = reports.reduce((sum, file) => sum + file.errorCount, 0)
  try {
    unlinkSync(outFile)
  } catch {
    /* ignore */
  }
  return { warnings, errors }
}

const counts = Object.keys(LINT_TARGETS).map((target) => [target, countWarnings(target)])
const labelWidth = Math.max(...counts.map(([target]) => target.length))

for (const [target, { errors, warnings }] of counts) {
  console.log(`${target.padEnd(labelWidth)}  ${errors} errors, ${warnings} warnings`)
}

if (process.argv.includes('--write')) {
  const next = {
    ...Object.fromEntries(counts.map(([target, { warnings }]) => [target, warnings])),
    _comment: 'pnpm lint 的 --max-warnings 上限；修复 warning 后请下调并提交本文件'
  }
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`\n已写入 ${baselinePath}`)
} else {
  console.log('\n若当前 warning 低于基线，可执行: pnpm lint:baseline -- --write')
}
