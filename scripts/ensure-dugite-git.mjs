#!/usr/bin/env node
/**
 * 确保 dugite 内置 Git 已下载（pnpm 10 默认不跑依赖 postinstall，需显式处理）。
 *
 * 用法:
 *   node scripts/ensure-dugite-git.mjs          # 缺失则下载
 *   node scripts/ensure-dugite-git.mjs --check  # 仅检查，缺失时 exit 1
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const require = createRequire(join(root, 'package.json'))

let dugiteRoot
try {
  dugiteRoot = dirname(require.resolve('dugite/package.json'))
} catch {
  console.error('[ensure-dugite-git] 未找到 dugite 包，请先在仓库根目录执行 pnpm install')
  process.exit(1)
}

const gitBinary =
  process.platform === 'win32'
    ? join(dugiteRoot, 'git', 'cmd', 'git.exe')
    : join(dugiteRoot, 'git', 'bin', 'git')

if (existsSync(gitBinary)) {
  if (!checkOnly) {
    console.log(`[ensure-dugite-git] 内置 Git 已就位: ${gitBinary}`)
  }
  process.exit(0)
}

if (checkOnly) {
  console.error(`[ensure-dugite-git] 内置 Git 未找到: ${gitBinary}`)
  console.error('请执行: pnpm setup:desktop  或  node scripts/ensure-dugite-git.mjs')
  process.exit(1)
}

const downloadScript = join(dugiteRoot, 'script', 'download-git.js')
console.log('[ensure-dugite-git] 正在下载 dugite 内置 Git（首次约数十 MB）…')

const result = spawnSync(process.execPath, [downloadScript], {
  cwd: dugiteRoot,
  stdio: 'inherit',
  env: process.env
})

if (result.status !== 0) {
  console.error('[ensure-dugite-git] 下载失败，请检查网络后重试')
  process.exit(result.status ?? 1)
}

if (!existsSync(gitBinary)) {
  console.error(`[ensure-dugite-git] 下载完成但未找到: ${gitBinary}`)
  process.exit(1)
}

console.log(`[ensure-dugite-git] 下载完成: ${gitBinary}`)
