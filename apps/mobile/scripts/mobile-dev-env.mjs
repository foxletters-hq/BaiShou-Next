#!/usr/bin/env node
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 读取 apps/mobile/.env（不依赖 dotenv 包） */
function loadDotEnv() {
  const envPath = path.join(mobileRoot, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

loadDotEnv()

/** 与 expo run:android 默认一致，避免 dev 与 android 端口不一致 */
export const METRO_PORT = process.env.RCT_METRO_PORT || process.env.EXPO_DEV_SERVER_PORT || '8081'

/** Clash / 部分 VPN 的假 IP 段，手机无法访问 */
const BLOCKED_PREFIXES = ['127.', '169.254.', '198.18.', '198.19.']

export function isUsableDevHost(ip) {
  if (!ip || typeof ip !== 'string') return false
  return !BLOCKED_PREFIXES.some((p) => ip.startsWith(p))
}

/**
 * 本机局域网 IP（供手机 Wi‑Fi 连接 Metro）。
 * 跳过 VPN 虚拟网卡；可用环境变量覆盖：REACT_NATIVE_PACKAGER_HOSTNAME
 */
export function getLanIp() {
  const override =
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME?.trim() || process.env.EXPO_PACKAGER_HOSTNAME?.trim()
  if (override && isUsableDevHost(override)) {
    return override
  }

  try {
    const out = execSync(
      'ip route get 1.1.1.1 2>/dev/null | awk \'{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}\'',
      { encoding: 'utf8' }
    ).trim()
    if (isUsableDevHost(out)) return out
  } catch {
    /* ignore */
  }

  const prefer192 = []
  const prefer10 = []
  const other = []

  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family !== 'IPv4' && iface.family !== 4) continue
      if (iface.internal) continue
      const addr = iface.address
      if (!isUsableDevHost(addr)) continue
      if (addr.startsWith('192.168.')) prefer192.push(addr)
      else if (addr.startsWith('10.')) prefer10.push(addr)
      else other.push(addr)
    }
  }

  return prefer192[0] || prefer10[0] || other[0] || '127.0.0.1'
}

export function hasAdbDevice() {
  try {
    const out = execSync('adb devices', { encoding: 'utf8' })
    return out.split('\n').some((line) => line.trim().endsWith('\tdevice'))
  } catch {
    return false
  }
}

/** USB 调试：把电脑 Metro 映射到手机 localhost */
export function setupAdbReverse(port = METRO_PORT) {
  if (!hasAdbDevice()) return false
  try {
    execSync(`adb reverse tcp:${port} tcp:${port}`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export function devClientEnv() {
  const host = getLanIp()
  return {
    ...process.env,
    REACT_NATIVE_PACKAGER_HOSTNAME: host,
    RCT_METRO_PORT: METRO_PORT
  }
}

/** 真机打开开发版：优先 USB adb reverse + localhost，否则用局域网 IP */
export function openDevClientOnDevice(lanHost = getLanIp(), port = METRO_PORT) {
  let bundleHost = lanHost
  if (setupAdbReverse(port)) {
    bundleHost = 'localhost'
    console.log(`\n🔌 已 adb reverse tcp:${port}，真机走 USB → http://localhost:${port}`)
  }

  const bundleUrl = `http://${bundleHost}:${port}`
  const deepLink = `mobile://expo-development-client/?url=${encodeURIComponent(bundleUrl)}`
  execSync(`adb shell am start -a android.intent.action.VIEW -d "${deepLink}"`, {
    stdio: 'inherit'
  })
  console.log(`\n📱 已在真机打开开发客户端 → ${bundleUrl}\n`)
}

export function printDevConnectionHelp(lanHost = getLanIp(), port = METRO_PORT) {
  const usb = hasAdbDevice()
  console.log('\n── 手机如何连上 Metro ──')
  console.log(`   局域网（同一 Wi‑Fi）: http://${lanHost}:${port}`)
  if (usb) {
    console.log(
      `   USB 数据线（推荐）  : http://localhost:${port}  （需先 adb reverse，dev 启动时会自动做）`
    )
  } else {
    console.log('   USB：插上手机并开启 USB 调试后，pnpm dev:mobile 会自动 adb reverse')
  }
  if (lanHost.startsWith('198.18.')) {
    console.log('\n   ⚠️  检测到 VPN 假 IP，请在终端执行：')
    console.log('   export REACT_NATIVE_PACKAGER_HOSTNAME=你的局域网IP   # 如 192.168.x.x')
    console.log('   然后重新 pnpm dev:mobile 与 pnpm mobile:android:clean\n')
  }
  if (process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
    console.log(
      `   当前覆盖 REACT_NATIVE_PACKAGER_HOSTNAME=${process.env.REACT_NATIVE_PACKAGER_HOSTNAME}`
    )
  }
  console.log('')
}
