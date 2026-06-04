#!/usr/bin/env node
/**
 * 将 packages/shared/assets/images/icon.png 同步到各端消费路径。
 * 唯一源文件：packages/shared/assets/images/icon.png
 *
 * 用法：
 *   node scripts/sync-app-icon.mjs          # 写入目标文件
 *   node scripts/sync-app-icon.mjs --check  # 仅校验，不一致时 exit 1
 */
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'packages/shared/assets/images/icon.png')
const targets = [
  join(root, 'apps/desktop/resources/icon.png'),
  join(root, 'apps/mobile/assets/images/icon.png')
]

const checkOnly = process.argv.includes('--check')

function md5(filePath) {
  return createHash('md5').update(readFileSync(filePath)).digest('hex')
}

const sourceHash = md5(source)
const outOfSync = targets.filter((target) => {
  try {
    return md5(target) !== sourceHash
  } catch {
    return true
  }
})

if (checkOnly) {
  if (outOfSync.length > 0) {
    console.error(
      '[sync-app-icon] 以下文件与源 icon 不一致或缺失，请执行: pnpm sync:icons\n' +
        outOfSync.map((p) => `  - ${p}`).join('\n')
    )
    process.exit(1)
  }
  console.log('[sync-app-icon] 各端 icon.png 已与 shared 源一致')
  process.exit(0)
}

for (const target of outOfSync.length > 0 ? outOfSync : targets) {
  copyFileSync(source, target)
  console.log(`[sync-app-icon] ${target}`)
}

if (outOfSync.length === 0) {
  console.log('[sync-app-icon] 已是最新，无需写入')
}
