#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  METRO_PORT,
  devClientEnv,
  getDevServerHost,
  getLanIp,
  hasAdbDevice,
  hasAdbReverse,
  openDevClientOnDevice,
  printDevConnectionHelp,
  setupAdbReverse,
  waitForMetro
} from './mobile-dev-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const clearCache = process.argv.includes('--clear')

const lanHost = getLanIp()

if (hasAdbDevice()) {
  setupAdbReverse(METRO_PORT)
}

const devHost = getDevServerHost(lanHost)
const env = devClientEnv()

console.log(`\n🌐 Metro 局域网地址: http://${lanHost}:${METRO_PORT}`)
if (devHost !== lanHost) {
  console.log(`🔌 Metro 真机地址 (adb reverse): http://${devHost}:${METRO_PORT}`)
}
printDevConnectionHelp(lanHost, METRO_PORT)
console.log('   升级 Expo / 原生依赖 / 闪退后请先: pnpm dev:mobile:clear\n')

const expoArgs = ['expo', 'start', '--dev-client', '--lan', '--port', METRO_PORT]
if (clearCache) {
  expoArgs.push('--clear')
}

const child = spawn('npx', expoArgs, {
  cwd: mobileRoot,
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32'
})

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Metro 就绪后刷新 reverse 并打开开发版；无线 adb 偶发掉线时自动重试 */
const tryOpenDeviceWithRetry = async () => {
  if (!hasAdbDevice()) return

  const ready = await waitForMetro(METRO_PORT, {
    timeoutMs: clearCache ? 180_000 : 120_000
  })
  if (!ready) {
    console.warn('\n⚠️  Metro 启动较慢或失败，仍可手动在手机上打开 App\n')
  }

  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (!hasAdbDevice()) {
      console.warn('\n⚠️  adb 已断开，请重连后执行: pnpm mobile:connect\n')
      printDevConnectionHelp(lanHost, METRO_PORT)
      return
    }
    setupAdbReverse(METRO_PORT)
    try {
      openDevClientOnDevice(lanHost, METRO_PORT)
      return
    } catch (e) {
      if (attempt < maxAttempts) {
        console.warn(`\n⚠️  第 ${attempt} 次打开开发版失败（${e.message}），3s 后重试 reverse…\n`)
        await sleep(3000)
      } else {
        console.warn(
          '\n⚠️  无法通过 adb 打开开发版，请执行 pnpm mobile:connect 或手动点开 App：',
          e.message,
          '\n'
        )
        printDevConnectionHelp(lanHost, METRO_PORT)
      }
    }
  }
}

void tryOpenDeviceWithRetry()

/** 无线 adb 时 reverse 可能真丢；连续两次确认后再静默重建，减少误报 */
let reverseMissStreak = 0
let reverseRebuildLogged = false

const reverseKeeper = setInterval(() => {
  if (!hasAdbDevice()) {
    reverseMissStreak = 0
    reverseRebuildLogged = false
    return
  }
  if (hasAdbReverse(METRO_PORT)) {
    reverseMissStreak = 0
    reverseRebuildLogged = false
    return
  }
  reverseMissStreak++
  if (reverseMissStreak < 2) return

  if (!reverseRebuildLogged) {
    console.warn(
      '\n🔁 adb reverse 已丢失（无线 adb / WSL adb 偶发断开），正在重新建立…',
      '仍频繁出现可改 USB 或执行 pnpm mobile:connect\n'
    )
    reverseRebuildLogged = true
  }
  setupAdbReverse(METRO_PORT)
}, 20_000)

child.on('exit', (code) => {
  clearInterval(reverseKeeper)
  process.exit(code ?? 0)
})
