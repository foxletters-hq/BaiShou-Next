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

/** WSL2：Metro 在 Linux 内；Windows 侧 adb reverse 的 localhost 指不到 WSL 里的 Metro */
export function isWsl() {
  if (process.platform !== 'linux') return false
  try {
    return fs.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')
  } catch {
    return false
  }
}

/** 从 hostname -I 挑选手机可访问的局域网 IP（WSL / VPN 场景更可靠） */
function getLanIpFromHostname() {
  try {
    const parts = execSync('hostname -I 2>/dev/null', { encoding: 'utf8' }).trim().split(/\s+/)
    const prefer192 = []
    const prefer10 = []
    const other = []
    for (const addr of parts) {
      if (!isUsableDevHost(addr)) continue
      if (addr.startsWith('192.168.')) prefer192.push(addr)
      else if (addr.startsWith('10.')) prefer10.push(addr)
      else if (!addr.startsWith('172.')) other.push(addr)
    }
    return prefer192[0] || prefer10[0] || other[0] || null
  } catch {
    return null
  }
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

  if (isWsl()) {
    const fromHostname = getLanIpFromHostname()
    if (fromHostname) return fromHostname
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

/** 当前 adb 是否已配置 reverse（USB 或无线调试均可） */
export function hasAdbReverse(port = METRO_PORT) {
  if (!hasAdbDevice()) return false
  try {
    const out = execSync('adb reverse --list', { encoding: 'utf8' })
    return out.includes(`tcp:${port} tcp:${port}`)
  } catch {
    return false
  }
}

/**
 * 供 deep link / REACT_NATIVE_PACKAGER_HOSTNAME 使用的 Metro 主机名。
 * 原生 Linux/macOS：adb reverse 时手机用 localhost 经 USB 隧道连 Metro。
 * WSL2：Metro 在 WSL，Windows adb reverse 只到 Windows 本机 → 必须用局域网 IP。
 */
export function getDevServerHost(lanHost = getLanIp(), port = METRO_PORT) {
  if (isWsl()) {
    return lanHost
  }
  if (hasAdbReverse(port)) {
    return 'localhost'
  }
  return lanHost
}

export function devClientEnv() {
  const lanHost = getLanIp()
  const host = getDevServerHost(lanHost)
  return {
    ...process.env,
    REACT_NATIVE_PACKAGER_HOSTNAME: host,
    RCT_METRO_PORT: METRO_PORT
  }
}

/**
 * 真机打开开发版：adb reverse 已就绪时用 localhost（手机侧经隧道连 Metro），否则用局域网 IP。
 */
export function openDevClientOnDevice(lanHost = getLanIp(), port = METRO_PORT) {
  if (hasAdbDevice()) {
    setupAdbReverse(port)
  }

  const devHost = getDevServerHost(lanHost, port)
  const bundleUrl = `http://${devHost}:${port}`
  const deepLink = `mobile://expo-development-client/?url=${encodeURIComponent(bundleUrl)}`
  execSync(`adb shell am start -a android.intent.action.VIEW -d "${deepLink}"`, {
    stdio: 'inherit'
  })
  if (devHost === 'localhost') {
    console.log(`\n🔌 adb reverse 已就绪，真机经 localhost 隧道连接 Metro`)
  }
  console.log(`\n📱 已在真机打开开发客户端 → ${bundleUrl}\n`)
}

export function printWslPortProxyHint(lanHost = getLanIp(), port = METRO_PORT) {
  console.log('\n── WSL2：手机连不上 localhost:' + port + ' 时 ──')
  console.log('   Metro 在 WSL 内；Windows 的 adb reverse 不会转发到 WSL。')
  console.log(`   请让手机使用局域网地址: http://${lanHost}:${port}`)
  console.log('   若同 Wi‑Fi 仍失败，在 **管理员 PowerShell** 执行一次端口转发：')
  console.log('   $wslIp = (wsl -e hostname -I).Trim().Split()[0]')
  console.log(
    `   netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=$wslIp`
  )
  console.log('   或在 WSL 内安装 adb（usbipd 绑定 USB），使 reverse 与 Metro 同环境。\n')
}

export function printDevConnectionHelp(lanHost = getLanIp(), port = METRO_PORT) {
  const adb = hasAdbDevice()
  const devHost = getDevServerHost(lanHost, port)
  const wsl = isWsl()
  console.log('\n── 手机如何连上 Metro ──')
  console.log(`   局域网（同一 Wi‑Fi）: http://${lanHost}:${port}`)
  if (wsl) {
    console.log(`   WSL2 自动打开 / 开发菜单请填: http://${lanHost}:${port} （勿用 localhost）`)
    printWslPortProxyHint(lanHost, port)
  } else if (adb) {
    console.log(`   adb reverse（USB/无线调试，自动打开优先）: http://localhost:${port}`)
    if (devHost === 'localhost') {
      console.log('   当前自动打开将使用 localhost（adb reverse 已生效）')
    }
  } else {
    console.log('   连接 adb 后会自动 reverse，届时可用 http://localhost:' + port)
  }
  if (lanHost.startsWith('198.18.')) {
    console.log('\n   ⚠️  检测到 VPN 假 IP，请复制 apps/mobile/.env.example 为 .env 并填写：')
    console.log('   REACT_NATIVE_PACKAGER_HOSTNAME=192.168.x.x')
    console.log('   然后重新 pnpm dev:mobile:clear 与 pnpm dev:mobile\n')
  }
  if (process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
    console.log(
      `   当前覆盖 REACT_NATIVE_PACKAGER_HOSTNAME=${process.env.REACT_NATIVE_PACKAGER_HOSTNAME}`
    )
  }
  if (!wsl) console.log('')
}
