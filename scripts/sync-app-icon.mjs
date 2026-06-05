#!/usr/bin/env node
/**
 * 以移动端 icon 为准，同步到 desktop / shared。
 *
 * 换 icon：覆盖 apps/mobile/assets/images/icon.png → 重编 APK。
 * Android 使用 legacy launcher（与 Flutter 一致），由系统自动加边距，无需再生成 foreground。
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const mobileIcon = join(root, 'apps/mobile/assets/images/icon.png')
const sharedIcon = join(root, 'packages/shared/assets/images/icon.png')
const desktopIcon = join(root, 'apps/desktop/resources/icon.png')

const checkOnly = process.argv.includes('--check')

function md5(filePath) {
  return createHash('md5').update(readFileSync(filePath)).digest('hex')
}

if (!existsSync(mobileIcon)) {
  console.error(`[sync-app-icon] 缺少移动端 icon：${mobileIcon}`)
  process.exit(1)
}

const mobileHash = md5(mobileIcon)
const staleTargets = [sharedIcon, desktopIcon].filter((target) => {
  try {
    return md5(target) !== mobileHash
  } catch {
    return true
  }
})

if (checkOnly) {
  if (staleTargets.length > 0) {
    console.error(
      '[sync-app-icon] desktop/shared 与 mobile icon 不一致，请执行: pnpm sync:icons\n' +
        staleTargets.map((p) => `  - ${p}`).join('\n')
    )
    process.exit(1)
  }
  console.log('[sync-app-icon] mobile icon 已同步到各端')
  process.exit(0)
}

for (const target of staleTargets) {
  copyFileSync(mobileIcon, target)
  console.log(`[sync-app-icon] ${target}`)
}

if (staleTargets.length === 0) {
  console.log('[sync-app-icon] desktop/shared 已是最新')
}
