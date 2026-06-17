#!/usr/bin/env node
/**
 * 从品牌源图生成各端图标，并校验 mobile 与 shared 一致。
 *
 * 换 icon：更新 packages/shared/assets/images/app-brand-icon-source.png → pnpm sync:icons
 * 桌面端 icon 为圆角透明 PNG；移动端 / shared 为方角全图。
 *
 * predev 会调用本脚本；仅当源图 MD5 与 stamp 不一致时才重新生成，避免每次 dev 改写 PNG 造成 git 噪声。
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourceIcon = join(root, 'packages/shared/assets/images/app-brand-icon-source.png')
const mobileIcon = join(root, 'apps/mobile/assets/images/icon.png')
const sharedIcon = join(root, 'packages/shared/assets/images/icon.png')
const desktopIcon = join(root, 'apps/desktop/resources/icon.png')
const stampPath = join(root, 'packages/shared/assets/images/.icon-build-stamp.json')
const generateScript = join(root, 'scripts/generate-app-icons.py')

const generatedOutputs = [
  mobileIcon,
  sharedIcon,
  desktopIcon,
  join(root, 'apps/mobile/assets/images/splash-icon.png'),
  join(root, 'apps/mobile/assets/images/android-icon-foreground.png')
]

const checkOnly = process.argv.includes('--check')
const force = process.argv.includes('--force')

function md5(filePath) {
  return createHash('md5').update(readFileSync(filePath)).digest('hex')
}

function readStamp() {
  try {
    return JSON.parse(readFileSync(stampPath, 'utf8'))
  } catch {
    return null
  }
}

function writeStamp(sourceHash) {
  writeFileSync(
    stampPath,
    `${JSON.stringify({ sourceMd5: sourceHash, generatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8'
  )
}

function allOutputsExist() {
  return generatedOutputs.every((filePath) => existsSync(filePath))
}

function needsRegenerate(sourceHash) {
  if (force) return true
  if (!allOutputsExist()) return true
  const stamp = readStamp()
  return !stamp || stamp.sourceMd5 !== sourceHash
}

const PYTHON_CANDIDATES =
  process.platform === 'win32'
    ? [
        { command: 'py', args: ['-3'] },
        { command: 'python', args: [] },
        { command: 'python3', args: [] }
      ]
    : [
        { command: 'python3', args: [] },
        { command: 'python', args: [] }
      ]

function runGenerate() {
  for (const { command, args } of PYTHON_CANDIDATES) {
    const result = spawnSync(command, [...args, generateScript, sourceIcon], {
      cwd: root,
      stdio: 'inherit'
    })
    if (result.error?.code === 'ENOENT') continue
    // Windows「应用执行别名」会把 python3 导向商店占位程序
    if (result.status === 9009) continue
    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }
    return true
  }

  if (existsSync(mobileIcon) && existsSync(desktopIcon)) {
    console.warn('[sync-app-icon] 未找到可用的 Python，跳过图标生成（沿用现有文件）')
    return false
  }

  console.error(
    '[sync-app-icon] 未找到 Python。请安装 Python 3（含 Pillow）后执行: pnpm sync:icons'
  )
  process.exit(1)
}

if (!existsSync(sourceIcon)) {
  console.error(`[sync-app-icon] 缺少品牌源图：${sourceIcon}`)
  process.exit(1)
}

const sourceHash = md5(sourceIcon)

if (!checkOnly) {
  if (needsRegenerate(sourceHash)) {
    const generated = runGenerate()
    if (generated !== false) {
      writeStamp(sourceHash)
    }
  } else {
    console.log('[sync-app-icon] 源图未变更，跳过生成')
  }
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

const stamp = readStamp()
const stampStale = !stamp || stamp.sourceMd5 !== sourceHash

if (checkOnly) {
  if (stampStale) {
    console.error(
      '[sync-app-icon] 图标产物与源图 stamp 不一致，请执行: pnpm sync:icons\n' +
        `  - stamp: ${stampPath}\n` +
        `  - source: ${sourceIcon}`
    )
    process.exit(1)
  }
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
