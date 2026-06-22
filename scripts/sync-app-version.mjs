#!/usr/bin/env node
/**
 * 以各端 src/version.json 为准，同步 package.json（及移动端 app.json）中的 version 字段。
 * version.json 只存 semver 数字（如 1.0.0）；Next 前缀由应用代码拼接，不写入 package.json。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')

const SEMVER_CORE_RE = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/

/** 兼容旧版 Next-1.0.0 与新版纯数字 1.0.0 */
function normalizeSemverOnly(raw) {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/^v+/i, '')
    .replace(/^next[-.\s]*/i, '')
    .trim()
  const match = cleaned.match(SEMVER_CORE_RE)
  if (!match) {
    throw new Error(`无效版本号 "${raw}"，请使用 semver 如 1.0.0`)
  }
  return match[1]
}

function readAppVersion(appDir) {
  const manifestPath = join(appDir, 'src/version.json')
  if (!existsSync(manifestPath)) {
    throw new Error(`缺少版本清单：${manifestPath}`)
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new Error(`${manifestPath} 缺少 version 字段`)
  }
  return normalizeSemverOnly(manifest.version)
}

function writeJsonIfChanged(filePath, nextObject) {
  const nextText = `${JSON.stringify(nextObject, null, 2)}\n`
  const prevText = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  if (prevText === nextText) return false
  if (!checkOnly) {
    writeFileSync(filePath, nextText)
  }
  return true
}

function syncDesktop() {
  const appDir = join(root, 'apps/desktop')
  const version = readAppVersion(appDir)
  const pkgPath = join(appDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const changed = pkg.version !== version
  if (changed) {
    pkg.version = version
    writeJsonIfChanged(pkgPath, pkg)
    console.log(`[sync-app-version] desktop package.json -> ${version}`)
  }
  return changed
}

function syncMobile() {
  const appDir = join(root, 'apps/mobile')
  const version = readAppVersion(appDir)
  let changed = false

  const pkgPath = join(appDir, 'package.json')
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  if (pkg.version !== version) {
    pkg.version = version
    if (writeJsonIfChanged(pkgPath, pkg)) {
      console.log(`[sync-app-version] mobile package.json -> ${version}`)
    }
    changed = true
  }

  const appJsonPath = join(appDir, 'app.json')
  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'))
  const manifestPath = join(appDir, 'src/version.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const versionCode = manifest.versionCode
  if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error(`${manifestPath} 缺少有效整数 versionCode（Android 覆盖安装依据，须单调递增）`)
  }

  let appJsonChanged = false
  if (appJson.expo?.version !== version) {
    appJson.expo.version = version
    appJsonChanged = true
  }
  if (appJson.expo?.android?.versionCode !== versionCode) {
    appJson.expo.android ??= {}
    appJson.expo.android.versionCode = versionCode
    appJsonChanged = true
  }
  if (appJsonChanged && writeJsonIfChanged(appJsonPath, appJson)) {
    console.log(`[sync-app-version] mobile app.json -> ${version} (versionCode ${versionCode})`)
    changed = true
  }

  return changed
}

let stale = false
try {
  stale = syncDesktop() || syncMobile()
} catch (e) {
  console.error(`[sync-app-version] ${e.message}`)
  process.exit(1)
}

if (checkOnly) {
  if (stale) {
    console.error(
      '[sync-app-version] 版本清单与 package.json / app.json 不一致，请执行: pnpm sync:app-version'
    )
    process.exit(1)
  }
  console.log('[sync-app-version] 各端版本字段已同步')
  process.exit(0)
}

if (!stale) {
  console.log('[sync-app-version] 各端版本字段已是最新')
}
