#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  METRO_PORT,
  devClientEnv,
  getLanIp,
  hasAdbDevice,
  openDevClientOnDevice,
  printDevConnectionHelp,
  setupAdbReverse
} from './mobile-dev-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const clearCache = process.argv.includes('--clear')

const host = getLanIp()
const env = devClientEnv()

console.log(`\n🌐 Metro 局域网地址: http://${host}:${METRO_PORT}`)
printDevConnectionHelp(host, METRO_PORT)
console.log('   首次 / 升级 Expo 或原生依赖后请先: pnpm mobile:android:clean\n')

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
  stdio: 'inherit'
})

let openedOnDevice = false

const tryOpenDevice = () => {
  if (openedOnDevice || !hasAdbDevice()) return
  openedOnDevice = true
  try {
    openDevClientOnDevice(host, METRO_PORT)
  } catch (e) {
    console.warn(
      '⚠️  无法通过 adb 打开开发版，请手动点开 App，并在开发菜单里填 Metro 地址:',
      e.message
    )
    printDevConnectionHelp(host, METRO_PORT)
  }
}

// Metro 就绪后再拉起 App
setTimeout(tryOpenDevice, clearCache ? 10000 : 6000)

child.on('exit', (code) => process.exit(code ?? 0))
