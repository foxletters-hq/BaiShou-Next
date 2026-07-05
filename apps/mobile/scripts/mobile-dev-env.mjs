#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process'
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

export const ANDROID_RELEASE_PACKAGE_ID = 'com.baishou.baishou'
export const ANDROID_DEV_PACKAGE_ID = 'com.baishou.baishou.dev'
const ANDROID_PACKAGE_ID = ANDROID_DEV_PACKAGE_ID
/** 历史包名，与当前 debug 签名不同，冲突时需一并卸载 */
const LEGACY_ANDROID_PACKAGE_IDS = ['com.anonymous.mobile']

function adbExec(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts
  })
}

function adbExecErrorText(err) {
  return [err.stdout, err.stderr, err.message].filter(Boolean).join('\n')
}

function isSignatureMismatchError(text) {
  return /INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match/i.test(text || '')
}

/** 卸载开发包及历史包名（与正式版 com.baishou.baishou 无关） */
export function uninstallConflictingPackages(packageId = ANDROID_PACKAGE_ID) {
  if (!hasAdbDevice()) return false
  const ids = [...new Set([packageId, ...LEGACY_ANDROID_PACKAGE_IDS])]
  let removed = false
  for (const id of ids) {
    try {
      const out = adbExec(`adb uninstall ${id}`)
      if (out.includes('Success')) {
        console.log(`📲 已卸载 ${id}（与当前 debug 签名不一致，无法直接覆盖）`)
        removed = true
      }
    } catch {
      /* 未安装 */
    }
  }
  return removed
}

/**
 * 编译安装前停止开发包进程。默认不卸载，以便同签名覆盖升级开发版。
 */
export function prepareAndroidInstall(
  packageId = ANDROID_PACKAGE_ID,
  options = { uninstallFirst: false }
) {
  if (!hasAdbDevice()) return false
  try {
    adbExec(`adb shell am force-stop ${packageId}`)
  } catch {
    /* 未安装时忽略 */
  }
  if (!options.uninstallFirst) return false
  return uninstallConflictingPackages(packageId)
}

const ADB_INSTALL_FLAGS = '-r -d -t'
const REMOTE_APK_PATH = '/data/local/tmp/baishou-app-debug.apk'

function tryStreamedInstall(absApk) {
  try {
    adbExec(`adb install ${ADB_INSTALL_FLAGS} "${absApk}"`)
    return { ok: true, method: 'streamed' }
  } catch (err) {
    return { ok: false, err: adbExecErrorText(err) }
  }
}

function tryPushInstall(absApk) {
  try {
    adbExec(`adb push "${absApk}" ${REMOTE_APK_PATH}`)
    const out = adbExec(`adb shell pm install ${ADB_INSTALL_FLAGS} ${REMOTE_APK_PATH}`)
    if (!out.includes('Success')) {
      return { ok: false, err: out.trim() || 'pm install 未返回 Success' }
    }
    return { ok: true, method: 'push' }
  } catch (err) {
    return { ok: false, err: adbExecErrorText(err) }
  } finally {
    try {
      adbExec(`adb shell rm -f ${REMOTE_APK_PATH}`)
    } catch {
      /* ignore */
    }
  }
}

const HTTP_INSTALL_PORT = 18765

/** 无线 adb 传大 APK 常失败；手机经局域网 curl 下载后 pm install（WSL2 + 小米更稳） */
function tryHttpInstall(absApk) {
  const lanIp = getLanIp()
  const apkDir = path.dirname(absApk)
  const apkName = path.basename(absApk)
  const url = `http://${lanIp}:${HTTP_INSTALL_PORT}/${apkName}`

  const server = spawn(
    'python3',
    ['-m', 'http.server', String(HTTP_INSTALL_PORT), '--bind', '0.0.0.0'],
    {
      cwd: apkDir,
      stdio: 'ignore'
    }
  )

  try {
    try {
      execSync(
        `for i in $(seq 1 25); do curl -sf -o /dev/null "http://127.0.0.1:${HTTP_INSTALL_PORT}/${apkName}" && exit 0; sleep 0.2; done; exit 1`,
        { stdio: 'pipe' }
      )
    } catch {
      return { ok: false, err: `无法在端口 ${HTTP_INSTALL_PORT} 启动临时 HTTP 服务（需 python3）` }
    }

    adbExec(`adb shell "curl -f -o ${REMOTE_APK_PATH} '${url}'"`)
    const out = adbExec(`adb shell pm install ${ADB_INSTALL_FLAGS} ${REMOTE_APK_PATH}`)
    if (!out.includes('Success')) {
      return { ok: false, err: out.trim() || 'pm install 未返回 Success' }
    }
    return { ok: true, method: 'http' }
  } catch (err) {
    return { ok: false, err: adbExecErrorText(err) }
  } finally {
    server.kill('SIGTERM')
    try {
      adbExec(`adb shell rm -f ${REMOTE_APK_PATH}`)
    } catch {
      /* ignore */
    }
  }
}

function installOnce(absApk) {
  const streamed = tryStreamedInstall(absApk)
  if (streamed.ok) return streamed
  const pushed = tryPushInstall(absApk)
  if (pushed.ok) return pushed
  const http = tryHttpInstall(absApk)
  if (http.ok) return http
  return { ok: false, err: [streamed.err, pushed.err, http.err].filter(Boolean).join('\n') }
}

/**
 * 安装 debug APK。无线 adb / 小米 MIUI 上流式 adb install 常间歇失败且无错误文案，
 * 故失败时自动改用 push + pm install。签名不一致时自动卸载旧包并重试一次。
 * @returns {'streamed' | 'push' | 'http'} 成功时使用的安装方式
 */
export function installApkViaAdb(apkPath) {
  const absApk = path.resolve(apkPath)
  if (!fs.existsSync(absApk)) {
    throw new Error(`找不到 APK: ${absApk}`)
  }
  if (!hasAdbDevice()) {
    throw new Error('未检测到 adb 设备')
  }

  let result = installOnce(absApk)
  if (!result.ok && isSignatureMismatchError(result.err)) {
    console.log('\n⚠️  检测到旧版签名与当前 debug 包不一致，正在卸载后重试…\n')
    if (uninstallConflictingPackages()) {
      result = installOnce(absApk)
    }
  }

  if (!result.ok) {
    throw new Error(result.err || 'adb 安装失败')
  }
  return result.method
}

/** 安装失败时在终端打印可复制的排查步骤 */
export function printAndroidInstallFailureHelp(apkPath, lastError = '') {
  const signatureHint = isSignatureMismatchError(lastError)
    ? `
⚠️  本次为签名冲突：手机里已有 ${ANDROID_DEV_PACKAGE_ID}，但 APK 签名与已安装版本不一致。
   请先卸载再装：
     adb uninstall ${ANDROID_DEV_PACKAGE_ID}
     adb uninstall com.anonymous.mobile
     pnpm mobile:install
`
    : ''

  console.error(`
❌ adb 安装 APK 失败
${signatureHint}
常见原因：
  · 旧包签名不同（Flutter 版 / 旧 Expo 包 com.anonymous.mobile）
  · 无线 adb 不稳定（大文件 push 报 protocol fault / write failed）
  · 小米手机：屏幕熄灭或未解锁时，「通过 USB 安装」确认窗可能不出现
  · 脚本已自动尝试 HTTP 下载安装；仍失败时请换 USB 线或重连无线 adb

建议（按顺序）：
  1. 卸载冲突包后重装：
     adb uninstall ${ANDROID_PACKAGE_ID}
     adb uninstall com.anonymous.mobile
     pnpm mobile:install
  2. 保持手机解锁、亮屏
  3. 无线调试时重连：
     adb disconnect && adb connect 192.168.31.10:5555

手动安装（push 方式，MIUI 上通常更稳）：
  adb push "${apkPath}" ${REMOTE_APK_PATH}
  adb shell pm install ${ADB_INSTALL_FLAGS} ${REMOTE_APK_PATH}
`)
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 结束旧进程，避免 DevLauncher 在 React 上下文未销毁时重启 MainActivity 崩溃 */
export function stopDevClientApp(packageId = ANDROID_DEV_PACKAGE_ID) {
  if (!hasAdbDevice()) return false
  try {
    adbExec(`adb shell am force-stop ${packageId}`)
    return true
  } catch {
    return false
  }
}

/**
 * 真机打开开发版：adb reverse 已就绪时用 localhost（手机侧经隧道连 Metro），否则用局域网 IP。
 * 默认先 force-stop，降低「App react context shouldn't be created before」竞态。
 */
export async function openDevClientOnDevice(
  lanHost = getLanIp(),
  port = METRO_PORT,
  { restart = true, settleMs = 700 } = {}
) {
  if (hasAdbDevice()) {
    setupAdbReverse(port)
    if (restart) {
      stopDevClientApp()
      if (settleMs > 0) {
        await sleep(settleMs)
      }
    }
  }

  const devHost = getDevServerHost(lanHost, port)
  const bundleUrl = `http://${devHost}:${port}`
  const deepLink = `mobile://expo-development-client/?url=${encodeURIComponent(bundleUrl)}`
  execSync(
    `adb shell am start -p ${ANDROID_DEV_PACKAGE_ID} -a android.intent.action.VIEW -d "${deepLink}"`,
    {
      stdio: 'inherit'
    }
  )
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

export function printDevConnectionHelp(lanHost = getLanIp(), port = METRO_PORT) {
  const adb = hasAdbDevice()
  const devHost = getDevServerHost(lanHost, port)
  const wsl = isWsl()
  console.log('\n── 手机如何连上 Metro ──')
  if (adb && devHost === 'localhost') {
    console.log(`   adb reverse（推荐，自动打开优先）: http://localhost:${port}`)
    if (wsl) {
      console.log('   WSL2：请在 WSL 内使用 adb（与 Metro 同环境），勿用 Windows 侧 adb')
    }
  } else if (adb) {
    console.log(`   adb 已连接但 reverse 未就绪，将执行: adb reverse tcp:${port} tcp:${port}`)
  } else {
    console.log('   连接 adb 后会自动 reverse，届时可用 http://localhost:' + port)
  }
  console.log(`   局域网（同一 Wi‑Fi，无 adb 时用）: http://${lanHost}:${port}`)
  if (adb) {
    try {
      const devices = execSync('adb devices', { encoding: 'utf8' })
      if (devices.includes(':5555')) {
        console.log(
          '   无线 adb：若连不上，先 adb disconnect 再 adb connect 手机IP:5555，然后 pnpm mobile:connect'
        )
      }
    } catch {
      /* ignore */
    }
  }
  if (wsl && devHost !== 'localhost') {
    console.log(
      `   WSL2 无 reverse 时开发菜单填: http://${lanHost}:${port} （需 portproxy 或 WSL 内 adb）`
    )
    printWslPortProxyHint(lanHost, port)
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
