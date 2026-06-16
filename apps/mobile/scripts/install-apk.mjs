#!/usr/bin/env node
/**
 * 安装已编译的 debug APK（dev:clear 编完但没点上手机「安装」时用）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  hasAdbDevice,
  installApkViaAdb,
  printAndroidInstallFailureHelp
} from './mobile-dev-env.mjs'

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apk = path.join(mobileRoot, 'android/app/build/outputs/apk/debug/app-debug.apk')

if (!fs.existsSync(apk)) {
  console.error('\n❌ 找不到 APK，请先编译：pnpm dev:mobile:clear\n')
  process.exit(1)
}

if (!hasAdbDevice()) {
  console.error('\n❌ 未检测到 adb 设备，请 USB 连接并开启调试。\n')
  process.exit(1)
}

console.log('\n📲 安装开发版 APK…\n')
try {
  const method = installApkViaAdb(apk)
  const via =
    method === 'push'
      ? '（流式安装失败，已改用 push + pm install，无线/MIUI 更稳）'
      : method === 'http'
        ? '（adb 传大文件失败，已改用手机经局域网 HTTP 下载后安装）'
        : ''
  console.log(`\n✅ 安装成功${via}。另开终端执行 pnpm dev:mobile，需要时可 pnpm mobile:connect\n`)
} catch (err) {
  printAndroidInstallFailureHelp(apk, err?.message)
  process.exit(1)
}
