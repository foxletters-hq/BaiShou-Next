#!/usr/bin/env node
/**
 * 统一同步入口：图标、版本号、供应商图标、视觉模型快照。
 *
 *   pnpm sync              全部同步（manifest 未变时各子脚本会快速跳过）
 *   pnpm sync:check        CI 校验生成物是否最新
 *   pnpm sync --only=icons 仅同步应用图标（逗号分隔：icons,version,providers,vision）
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const check = process.argv.includes('--check')

const onlyArg = process.argv.find((a) => a.startsWith('--only='))
const only = onlyArg
  ? new Set(
      onlyArg
        .slice('--only='.length)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  : null

const steps = [
  { key: 'icons', label: '应用图标', script: 'sync-app-icon.mjs' },
  { key: 'version', label: '版本号', script: 'sync-app-version.mjs' },
  { key: 'providers', label: '供应商图标', script: 'sync-provider-icons.mjs' },
  { key: 'vision', label: '视觉模型快照', script: 'sync-vision-models.mjs' }
]

const selected = only ? steps.filter((s) => only.has(s.key)) : steps

if (only && selected.length === 0) {
  console.error(
    '[sync] 未知 --only 项。可用: icons, version, providers, vision\n' +
      '示例: pnpm sync --only=providers,vision'
  )
  process.exit(1)
}

function runStep({ label, script }) {
  const args = [path.join(root, 'scripts', script)]
  if (check) args.push('--check')

  console.log(`\n── ${label}${check ? '（检查）' : ''} ──`)
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' })
  return result.status === 0
}

console.log(check ? '\n[sync] 检查生成物…' : '\n[sync] 同步生成物…')

let failed = false
for (const step of selected) {
  if (!runStep(step)) {
    failed = true
    break
  }
}

if (failed) {
  console.error(`\n[sync] 失败。${check ? '' : '修复后重试: pnpm sync'}\n`)
  process.exit(1)
}

console.log(`\n[sync] ${check ? '全部通过' : '完成'}\n`)
