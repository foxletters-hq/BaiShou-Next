#!/usr/bin/env node
/**
 * 将 Android 签名配置放到 apps/mobile/android/key.properties（不入库）。
 * 优先级：1) 旧版 BaiShou 仓库  2) 环境变量  3) 已存在的目标文件
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const legacyKeyPaths = [
  join(root, '../BaiShou/android/key.properties'),
  '/mnt/d/Projects/BaiShou/android/key.properties'
]
const destDir = join(root, 'apps/mobile/android')
const destPath = join(destDir, 'key.properties')

function findLegacyKeyPath() {
  return legacyKeyPaths.find((p) => existsSync(p))
}

function writeFromEnv() {
  const storePassword = process.env.ANDROID_STORE_PASSWORD?.trim()
  const keyPassword = process.env.ANDROID_KEY_PASSWORD?.trim()
  const keyAlias = process.env.ANDROID_KEY_ALIAS?.trim()
  const storeBase64 = process.env.ANDROID_KEYSTORE_BASE64?.trim()
  const storeFile = process.env.ANDROID_KEYSTORE_FILE?.trim()

  if (!storePassword || !keyPassword || !keyAlias) return false
  if (!storeBase64 && !storeFile) return false

  const lines = [
    `storePassword=${storePassword}`,
    `keyPassword=${keyPassword}`,
    `keyAlias=${keyAlias}`
  ]
  if (storeBase64) {
    lines.push(`storeBase64=${storeBase64}`)
  } else {
    lines.push(`storeFile=${storeFile}`)
  }

  mkdirSync(destDir, { recursive: true })
  writeFileSync(destPath, `${lines.join('\n')}\n`, { mode: 0o600 })
  console.log('[setup-android-signing] 已从环境变量写入 apps/mobile/android/key.properties')
  return true
}

function maskKeyProperties(text) {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.replace(/\r$/, '')
      if (trimmed.startsWith('storeBase64=')) {
        return `storeBase64=(已设置，长度 ${trimmed.length} 字符)`
      }
      if (trimmed.startsWith('storePassword=') || trimmed.startsWith('keyPassword=')) {
        return trimmed.replace(/=.*/, '=***')
      }
      return trimmed
    })
    .join('\n')
}

if (existsSync(destPath)) {
  console.log('[setup-android-signing] 已存在 apps/mobile/android/key.properties，跳过')
  console.log(maskKeyProperties(readFileSync(destPath, 'utf8')))
  process.exit(0)
}

const legacyKeyPath = findLegacyKeyPath()
if (legacyKeyPath) {
  mkdirSync(destDir, { recursive: true })
  copyFileSync(legacyKeyPath, destPath)
  console.log(`[setup-android-signing] 已从旧版仓库复制: ${legacyKeyPath}`)
  console.log('  -> apps/mobile/android/key.properties')
  process.exit(0)
}

if (writeFromEnv()) {
  process.exit(0)
}

console.error(`
[setup-android-signing] 未找到 Android 签名配置。

请任选一种方式：

1) 从旧版 Flutter 仓库复制（推荐）：
   cp ../BaiShou/android/key.properties apps/mobile/android/key.properties
   # WSL 下若旧版在 D 盘：/mnt/d/Projects/BaiShou/android/key.properties

2) 按 apps/mobile/key.properties.example 手动创建 apps/mobile/android/key.properties

3) 设置环境变量后重试：
   ANDROID_STORE_PASSWORD / ANDROID_KEY_PASSWORD / ANDROID_KEY_ALIAS
   以及 ANDROID_KEYSTORE_BASE64（本地）或 ANDROID_KEYSTORE_FILE（CI 用相对路径）

注意：key.properties 与 .jks 已加入 .gitignore，不会上传到 Git。
CI 使用 GitHub Secrets（ANDROID_KEYSTORE_BASE64 等），与旧版 BaiShou 仓库相同。
`)
process.exit(1)
