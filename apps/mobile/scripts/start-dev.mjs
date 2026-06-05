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
  openDevClientOnDevice,
  printDevConnectionHelp,
  setupAdbReverse
} from './mobile-dev-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const clearCache = process.argv.includes('--clear')

const lanHost = getLanIp()
const devHost = getDevServerHost(lanHost)
const env = devClientEnv()

console.log(`\n🌐 Metro 局域网地址: http://${lanHost}:${METRO_PORT}`)
if (devHost !== lanHost) {
  console.log(`🔌 Metro 真机地址 (adb reverse): http://${devHost}:${METRO_PORT}`)
}
printDevConnectionHelp(lanHost, METRO_PORT)
console.log('   升级 Expo / 原生依赖 / 闪退后请先: pnpm dev:mobile:clear\n')

if (hasAdbDevice()) {
  setupAdbReverse(METRO_PORT)
}

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

let openedOnDevice = false

const tryOpenDevice = () => {
  if (openedOnDevice || !hasAdbDevice()) return
  openedOnDevice = true
  try {
    openDevClientOnDevice(lanHost, METRO_PORT)
  } catch (e) {
    console.warn(
      '⚠️  无法通过 adb 打开开发版，请手动点开 App，并在开发菜单里填 Metro 地址:',
      e.message
    )
    printDevConnectionHelp(lanHost, METRO_PORT)
  }
}

// Metro 就绪后再拉起 App
setTimeout(tryOpenDevice, clearCache ? 10000 : 6000)

child.on('exit', (code) => process.exit(code ?? 0))
