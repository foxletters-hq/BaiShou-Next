#!/usr/bin/env node
/**
 * 从品牌源图生成各端图标，并校验 mobile 与 shared 一致。
 *
 * 换 icon：更新 packages/shared/assets/images/app-brand-icon-source.png → pnpm sync:icons
 * 桌面端 icon 为圆角透明 PNG；移动端 / shared 为方角全图。
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceIcon = join(root, 'packages/shared/assets/images/app-brand-icon-source.png')
const mobileIcon = join(root, 'apps/mobile/assets/images/icon.png')
const sharedIcon = join(root, 'packages/shared/assets/images/icon.png')
const desktopIcon = join(root, 'apps/desktop/resources/icon.png')
const generateScript = join(root, 'scripts/generate-app-icons.py')

const checkOnly = process.argv.includes('--check')

function md5(filePath) {
  return createHash('md5').update(readFileSync(filePath)).digest('hex')
}

function runGenerate() {
  const result = spawnSync('python3', [generateScript, sourceIcon], {
    cwd: root,
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (!checkOnly) {
  if (!existsSync(sourceIcon)) {
    console.error(`[sync-app-icon] 缺少品牌源图：${sourceIcon}`)
    process.exit(1)
  }
  runGenerate()
}

if (!existsSync(mobileIcon)) {
  console.error(`[sync-app-icon] 缺少移动端 icon：${mobileIcon}`)
  process.exit(1)
}

if (!existsSync(desktopIcon)) {
  console.error(`[sync-app-icon] 缺少桌面端 icon：${desktopIcon}`)
  process.exit(1)
}

const mobileHash = md5(mobileIcon)
let sharedStale = false
try {
  sharedStale = md5(sharedIcon) !== mobileHash
} catch {
  sharedStale = true
}

if (checkOnly) {
  if (sharedStale) {
    console.error(
      '[sync-app-icon] shared 与 mobile icon 不一致，请执行: pnpm sync:icons\n' +
        `  - ${sharedIcon}`
    )
    process.exit(1)
  }
  console.log('[sync-app-icon] 各端图标已与源图同步')
  process.exit(0)
}

if (sharedStale) {
  copyFileSync(mobileIcon, sharedIcon)
  console.log(`[sync-app-icon] ${sharedIcon}`)
} else {
  console.log('[sync-app-icon] mobile/shared 已是最新')
}
