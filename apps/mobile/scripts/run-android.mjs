#!/usr/bin/env node
/**
 * 全量重装：清 Metro / .expo / Gradle 缓存 → 无构建缓存重编 → 安装开发版 APK。
 * 对应根目录 pnpm dev:mobile:clear；日常只改 JS 请用 pnpm dev:mobile。
 */
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import {
  METRO_PORT,
  devClientEnv,
  getLanIp,
  hasAdbDevice,
  prepareAndroidInstall,
  printAndroidInstallFailureHelp,
  printDevConnectionHelp,
  setupAdbReverse
} from './mobile-dev-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const host = getLanIp()

console.log(`
📌 全量重装 Android 开发版（非 Expo Go）
   → 清 Metro / .expo / Gradle 缓存，重新编译并安装 APK
   → 建议先在手机上卸载旧版：com.anonymous.mobile
   → 完成后在仓库根目录执行 pnpm dev:mobile 启动 Metro
`)

console.log('🧹 清理缓存…\n')
const cacheResult = spawnSync(process.execPath, [path.join(__dirname, 'clear-cache.mjs')], {
  cwd: mobileRoot,
  stdio: 'inherit'
})
if (cacheResult.status !== 0) {
  process.exit(cacheResult.status ?? 1)
}

if (hasAdbDevice()) {
  setupAdbReverse(METRO_PORT)
  prepareAndroidInstall()
}

console.log(`\n🔨 编译安装 Android 开发版，Metro 将用: http://${host}:${METRO_PORT}\n`)
printDevConnectionHelp(host, METRO_PORT)

const args = ['expo', 'run:android', '--port', String(METRO_PORT), '--no-build-cache']

const child = spawn('npx', args, {
  cwd: mobileRoot,
  env: devClientEnv(),
  stdio: 'inherit'
})

child.on('exit', (code) => {
  if (code !== 0) {
    const apk = path.join(mobileRoot, 'android/app/build/outputs/apk/debug/app-debug.apk')
    if (fs.existsSync(apk) && hasAdbDevice()) {
      printAndroidInstallFailureHelp(apk)
    }
  }
  process.exit(code ?? 0)
})
