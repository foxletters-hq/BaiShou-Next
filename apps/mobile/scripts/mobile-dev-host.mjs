import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 读取 apps/mobile/.env（不依赖 dotenv 包） */
export function loadDotEnv() {
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

/** Tailscale / CGNAT（100.64.0.0/10），手机在普通 Wi‑Fi 上通常无法直连 */
const DEPRIORITIZED_PREFIXES = ['100.', '172.']

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
      if (DEPRIORITIZED_PREFIXES.some((p) => addr.startsWith(p))) continue
      if (addr.startsWith('192.168.')) prefer192.push(addr)
      else if (addr.startsWith('10.')) prefer10.push(addr)
      else other.push(addr)
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

function adbQuick(cmd, timeoutMs = 5000) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: timeoutMs
  })
}

export function hasAdbDevice() {
  try {
    const out = adbQuick('adb devices')
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

let lastKnownReverseOk = false

/** 当前 adb 是否已配置 reverse（USB 或无线调试均可） */
export function hasAdbReverse(port = METRO_PORT) {
  if (!hasAdbDevice()) {
    lastKnownReverseOk = false
    return false
  }
  try {
    const out = adbQuick('adb reverse --list')
    const ok = out.includes(`tcp:${port} tcp:${port}`)
    lastKnownReverseOk = ok
    return ok
  } catch {
    // WSL2 + 无线 adb 时 adb 偶发超时，勿误判为 reverse 丢失
    return lastKnownReverseOk
  }
}

/**
 * 供 deep link / REACT_NATIVE_PACKAGER_HOSTNAME 使用的 Metro 主机名。
 * adb reverse 已就绪时手机用 localhost 经隧道连 Metro（WSL 内 adb 与 Metro 同环境，同样适用）。
 * WSL2 且无 reverse：Windows 侧 adb reverse 到不了 WSL Metro，需局域网 IP 或 portproxy。
 */
export function getDevServerHost(lanHost = getLanIp(), port = METRO_PORT) {
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
 * Gradle 编译耗时较长时无线 adb 的 reverse 可能丢失；定时重建避免首屏 FileNotFoundException。
 * @returns {() => void} 调用以停止保活
 */
export function startReverseKeeper(port = METRO_PORT, intervalMs = 20_000) {
  let missStreak = 0
  let rebuildLogged = false

  const timer = setInterval(() => {
    if (!hasAdbDevice()) {
      missStreak = 0
      rebuildLogged = false
      return
    }
    if (hasAdbReverse(port)) {
      missStreak = 0
      rebuildLogged = false
      return
    }
    missStreak++
    if (missStreak < 2) return

    if (!rebuildLogged) {
      console.warn(
        `\n🔁 adb reverse 已丢失（无线 adb / 长时编译后常见），正在重新建立…`,
        '仍频繁出现可改 USB 或执行 pnpm mobile:connect\n'
      )
      rebuildLogged = true
    }
    setupAdbReverse(port)
  }, intervalMs)

  return () => clearInterval(timer)
}

/** 轮询 Metro /status，就绪后再用 adb 打开 App，避免固定延时不够 */
export async function waitForMetro(
  port = METRO_PORT,
  { timeoutMs = 120_000, intervalMs = 500 } = {}
) {
  const deadline = Date.now() + timeoutMs
  const url = `http://127.0.0.1:${port}/status`
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {
      /* Metro 尚未监听 */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}
