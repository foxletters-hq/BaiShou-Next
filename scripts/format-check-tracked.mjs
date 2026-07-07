#!/usr/bin/env node
/**
 * Prettier 检查：仅已纳入 Git 跟踪的文件（忽略工作区未跟踪草稿）。
 * CI 与 `pnpm ci:check` 使用（仅 Git 已跟踪文件）。
 */
import { spawnSync } from 'node:child_process'
import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const TRACKED_EXT_RE = /\.(ts|tsx|js|mjs|cjs|json|md|yaml|yml|css)$/
const BATCH_SIZE = 200

const root = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim()

/** @returns {string[]} */
function listTrackedTargets() {
  const raw = execSync('git ls-files -z', { cwd: root, encoding: 'utf8' })
  return raw
    .split('\0')
    .filter((file) => file && TRACKED_EXT_RE.test(file) && existsSync(join(root, file)))
}

const files = listTrackedTargets()
if (files.length === 0) {
  console.log('[format:check] 无已跟踪的格式化目标文件')
  process.exit(0)
}

for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE).map((file) => join(root, file))
  const result = spawnSync(
    'pnpm',
    ['exec', 'prettier', '--check', ...batch, '--ignore-path', join(root, '.prettierignore')],
    { cwd: root, stdio: 'inherit' }
  )
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status)
  }
}
