#!/usr/bin/env node
/**
 * 移动端开发用生成物：sync 图标/版本等 + 重打 diary-editor WebView bundle。
 * predev / predev:clear 与 run-android（直接 node 调用时）共用。
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(mobileRoot, '../..')

console.log('\n🔄 同步生成物…\n')
const syncResult = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/sync-all.mjs')], {
  cwd: repoRoot,
  stdio: 'inherit'
})
if (syncResult.status !== 0) {
  process.exit(syncResult.status ?? 1)
}

console.log('\n📦 重新打包 diary-editor WebView bundle…\n')
const buildEditor = spawnSync('pnpm', ['run', 'build:diary-editor'], {
  cwd: mobileRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})
if (buildEditor.status !== 0) {
  process.exit(buildEditor.status ?? 1)
}

console.log('\n✓ 开发用生成物已更新（sync + diary-editor）\n')
