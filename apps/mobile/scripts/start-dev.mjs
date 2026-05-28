#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  METRO_PORT,
  devClientEnv,
  getLanIp,
  hasAdbDevice,
  openDevClientOnDevice
} from './mobile-dev-env.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const clearCache = process.argv.includes('--clear')

const host = getLanIp()
const env = devClientEnv()

console.log(`\n🌐 Metro: http://${host}:${METRO_PORT}`)
console.log('   请保持手机和电脑在同一 Wi‑Fi；首次请先执行: pnpm android:mobile\n')

const expoArgs = ['expo', 'start', '--dev-client', '--port', METRO_PORT]
if (clearCache) {
  expoArgs.push('-c')
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
    console.warn('⚠️  无法通过 adb 打开开发版，请手动点开手机上的 App:', e.message)
  }
}

// Metro 就绪后再拉起 App，避免连到未启动的 bundler
setTimeout(tryOpenDevice, clearCache ? 8000 : 5000)

child.on('exit', (code) => process.exit(code ?? 0))
