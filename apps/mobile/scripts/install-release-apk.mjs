#!/usr/bin/env node
/**
 * 安装 release/ 目录下最新正式版 APK（BaiShou-v*-Android.apk）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ANDROID_RELEASE_PACKAGE_ID,
  hasAdbDevice,
  installReleaseApkViaAdb,
  printReleaseInstallFailureHelp
} from './mobile-dev-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(mobileRoot, '../..')
const releaseDir = path.join(repoRoot, 'release')

const APK_NAME_RE = /^BaiShou-v(.+)-Android\.apk$/i

function compareSemver(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da !== db) return da - db
  }
  return 0
}

/** 在 release/ 中按 semver 取最新 BaiShou-v*-Android.apk */
export function findLatestReleaseApk(dir = releaseDir) {
  if (!fs.existsSync(dir)) {
    return null
  }

  let best = null
  for (const name of fs.readdirSync(dir)) {
    const match = name.match(APK_NAME_RE)
    if (!match) continue
    const version = match[1]
    const fullPath = path.join(dir, name)
    if (!best || compareSemver(version, best.version) > 0) {
      best = { version, path: fullPath, name }
    }
  }
  return best
}

const latest = findLatestReleaseApk()

if (!latest) {
  console.error(`\n❌ 未找到正式版 APK，请先构建：pnpm release:android`)
  console.error(`   期望路径：${releaseDir}/BaiShou-v*-Android.apk\n`)
  process.exit(1)
}

if (!hasAdbDevice()) {
  console.error('\n❌ 未检测到 adb 设备，请 USB 连接并开启调试。\n')
  process.exit(1)
}

console.log(`\n📲 安装正式版 ${latest.name}（v${latest.version}）…\n`)

try {
  const method = installReleaseApkViaAdb(latest.path)
  const via =
    method === 'push'
      ? '（流式安装失败，已改用 push + pm install）'
      : method === 'http'
        ? '（adb 传大文件失败，已改用手机经局域网 HTTP 下载后安装）'
        : ''
  console.log(`\n✅ 正式版 v${latest.version} 安装成功${via}（${ANDROID_RELEASE_PACKAGE_ID}）\n`)
} catch (err) {
  printReleaseInstallFailureHelp(latest.path, err?.message)
  process.exit(1)
}
