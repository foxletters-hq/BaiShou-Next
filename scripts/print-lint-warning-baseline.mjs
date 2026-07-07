#!/usr/bin/env node
/**
 * 统计 desktop / mobile 当前 ESLint warning 数，便于下调 lint-warning-baseline.json。
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const baselinePath = join(root, 'scripts', 'lint-warning-baseline.json')

/** @param {'desktop' | 'mobile'} app */
function countWarnings(app) {
  const outFile = join(root, `.lint-count-${app}.json`)
  const cwd = join(root, 'apps', app)
  const result = spawnSync('pnpm', ['exec', 'eslint', '.', '-f', 'json', '-o', outFile], {
    cwd,
    encoding: 'utf8'
  })
  if (result.status !== 0 && result.status !== 1) {
    console.error(`[lint:baseline] ${app} eslint 失败`)
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

const desktop = countWarnings('desktop')
const mobile = countWarnings('mobile')

console.log(`desktop: ${desktop.errors} errors, ${desktop.warnings} warnings`)
console.log(`mobile:  ${mobile.errors} errors, ${mobile.warnings} warnings`)

if (process.argv.includes('--write')) {
  const next = {
    desktop: desktop.warnings,
    mobile: mobile.warnings,
    _comment: 'pnpm lint 的 --max-warnings 上限；修复 warning 后请下调并提交本文件'
  }
  writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`)
  console.log(`\n已写入 ${baselinePath}`)
} else {
  console.log('\n若当前 warning 低于基线，可执行: pnpm lint:baseline -- --write')
}
