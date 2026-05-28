#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  METRO_PORT,
  devClientEnv,
  getLanIp,
  hasAdbDevice,
  printDevConnectionHelp,
  setupAdbReverse
} from './mobile-dev-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const clean = process.argv.includes('--clean')
const host = getLanIp()

if (clean) {
  console.log(`
📌 升级 Expo / 原生依赖 / 启动闪退后请用本命令
   → 清 Gradle 缓存，重新编译并安装开发版 APK（不是 Expo Go）
   → 建议先在手机上卸载旧版：com.anonymous.mobile
`)
  console.log('🧹 清理 .expo / Gradle 构建目录…\n')
  const cacheResult = spawnSync(process.execPath, [path.join(__dirname, 'clear-cache.mjs')], {
    cwd: mobileRoot,
    stdio: 'inherit'
  })
  if (cacheResult.status !== 0) {
    process.exit(cacheResult.status ?? 1)
  }
} else {
  console.log(`
📌 增量安装开发版 APK
   → 只改 JS/TS 时不必重跑，在仓库根目录执行 pnpm dev:mobile 即可
   → 升级 Expo 后请改用: pnpm mobile:android:clean（根目录）
`)
}

if (hasAdbDevice()) {
  setupAdbReverse(METRO_PORT)
}

console.log(`🔨 编译安装 Android 开发版，Metro: http://${host}:${METRO_PORT}\n`)
printDevConnectionHelp(host, METRO_PORT)

const args = ['expo', 'run:android', '--port', String(METRO_PORT)]
if (clean) {
  // Expo SDK 55+：-c 已移除，用 --no-build-cache 清原生构建缓存
  args.push('--no-build-cache')
}

const child = spawn('npx', args, {
  cwd: mobileRoot,
  env: devClientEnv(),
  stdio: 'inherit'
})

child.on('exit', (code) => process.exit(code ?? 0))
