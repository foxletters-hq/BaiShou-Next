#!/usr/bin/env node
/**
 * 校验移动端原生能力（对齐桌面 ensure-electron-native 的「启动前探测」）：
 * - 宿主：app.json 已开 withSQLiteVecExtension；expo-sqlite 预置各 ABI 的 vec.so
 * - 真机（adb 原生 API）：getprop 读设备 ABI；pm path + unzip 检查已装 Dev APK 是否含对应 vec.so
 *
 * 移动端无法像 Electron 那样秒级 rebuild；默认只报告并给出
 * `pnpm dev:mobile:clear` 提示。设置 BAISHOU_MOBILE_NATIVE_AUTO_REBUILD=1
 * 时，在真机缺失/ABI 不匹配时可自动触发全量重装（耗时长）。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ANDROID_DEV_PACKAGE_ID,
  hasAdbDevice
} from './mobile-dev-env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const mobileRoot = join(__dirname, '..')
const requireFromMobile = createRequire(join(mobileRoot, 'package.json'))

const REQUIRED_ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86']
const VEC_SO_NAME = 'vec.so'

const AUTO_REBUILD =
  process.env.BAISHOU_MOBILE_NATIVE_AUTO_REBUILD === '1' ||
  process.argv.includes('--fix')

function log(msg) {
  console.log(`[ensure-mobile-native] ${msg}`)
}

function warn(msg) {
  console.warn(`[ensure-mobile-native] ${msg}`)
}

function adb(args, opts = {}) {
  return execFileSync('adb', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts
  }).trim()
}

function readAppJsonSqliteVecEnabled() {
  const appJsonPath = join(mobileRoot, 'app.json')
  const appJson = JSON.parse(readFileSync(appJsonPath, 'utf8'))
  const plugins = appJson?.expo?.plugins
  if (!Array.isArray(plugins)) return false
  for (const plugin of plugins) {
    if (plugin === 'expo-sqlite') return false
    if (Array.isArray(plugin) && plugin[0] === 'expo-sqlite') {
      const props = plugin[1] || {}
      return Boolean(props.withSQLiteVecExtension || props.android?.withSQLiteVecExtension)
    }
  }
  return false
}

function resolveExpoSqliteAndroidVecDir() {
  try {
    const pkgJson = requireFromMobile.resolve('expo-sqlite/package.json')
    return join(dirname(pkgJson), 'android', 'vec')
  } catch {
    return null
  }
}

/** 用 file(1) 读 ELF 机型，交叉核对预置 .so 是否像对应 ABI */
function probeElfMachine(soPath) {
  try {
    const out = execFileSync('file', ['-b', soPath], { encoding: 'utf8' }).trim()
    return out
  } catch {
    return null
  }
}

function expectElfHint(abi) {
  switch (abi) {
    case 'arm64-v8a':
      return /aarch64|ARM aarch64/i
    case 'armeabi-v7a':
      return /\bARM\b/i
    case 'x86_64':
      return /x86-64|x86_64/i
    case 'x86':
      return /80386|i386|Intel 80386/i
    default:
      return /./
  }
}

function checkHostVecArtifacts() {
  const issues = []
  if (!readAppJsonSqliteVecEnabled()) {
    issues.push('app.json 未启用 expo-sqlite.withSQLiteVecExtension')
  }

  const vecDir = resolveExpoSqliteAndroidVecDir()
  if (!vecDir || !existsSync(vecDir)) {
    issues.push('未找到 expo-sqlite/android/vec（请 pnpm install）')
    return { ok: false, issues, vecDir: null, presentAbis: [] }
  }

  const presentAbis = []
  for (const abi of REQUIRED_ABIS) {
    const soPath = join(vecDir, abi, VEC_SO_NAME)
    if (!existsSync(soPath)) {
      issues.push(`缺少预置 ${abi}/${VEC_SO_NAME}`)
      continue
    }
    presentAbis.push(abi)
    const elf = probeElfMachine(soPath)
    if (elf && !expectElfHint(abi).test(elf)) {
      issues.push(`${abi}/${VEC_SO_NAME} ELF 机型异常: ${elf}`)
    }
  }

  return { ok: issues.length === 0, issues, vecDir, presentAbis }
}

function listApkNativeLibs(apkPath) {
  try {
    const out = execFileSync('unzip', ['-Z1', apkPath], { encoding: 'utf8' })
    return out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('lib/') && l.endsWith(`/${VEC_SO_NAME}`))
  } catch {
    try {
      const out = execFileSync('zipinfo', ['-1', apkPath], { encoding: 'utf8' })
      return out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('lib/') && l.endsWith(`/${VEC_SO_NAME}`))
    } catch {
      return null
    }
  }
}

function abisFromVecLibEntries(entries) {
  const abis = new Set()
  for (const entry of entries || []) {
    // lib/arm64-v8a/vec.so
    const m = entry.match(/^lib\/([^/]+)\/vec\.so$/)
    if (m) abis.add(m[1])
  }
  return [...abis]
}

function getDeviceAbis() {
  const primary = adb(['shell', 'getprop', 'ro.product.cpu.abi'])
  const listRaw = adb(['shell', 'getprop', 'ro.product.cpu.abilist'])
  const list = listRaw
    ? listRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : primary
      ? [primary]
      : []
  return { primary, list: list.length > 0 ? list : primary ? [primary] : [] }
}

function pullInstalledDevApk() {
  const pathLine = adb(['shell', 'pm', 'path', ANDROID_DEV_PACKAGE_ID])
  const remote = pathLine
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.startsWith('package:'))
    ?.slice('package:'.length)
  if (!remote) return null

  const dir = mkdtempSync(join(tmpdir(), 'baishou-mobile-native-'))
  const localApk = join(dir, 'base.apk')
  try {
    adb(['pull', remote, localApk])
    return { dir, localApk }
  } catch (e) {
    rmSync(dir, { recursive: true, force: true })
    throw e
  }
}

function findLocalDebugApk() {
  const candidates = [
    join(mobileRoot, 'android/app/build/outputs/apk/debug/app-debug.apk'),
    join(mobileRoot, 'android/app/build/outputs/apk/debug/app-dev-debug.apk')
  ]
  return candidates.find((p) => existsSync(p)) || null
}

function triggerAutoRebuild() {
  warn('BAISHOU_MOBILE_NATIVE_AUTO_REBUILD=1 / --fix：开始全量重装开发版 APK…')
  const result = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['run', 'dev:clear'],
    {
      cwd: mobileRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env
    }
  )
  return result.status === 0
}

function checkApkCoversDevice(apkPath, devicePrimaryAbi) {
  const entries = listApkNativeLibs(apkPath)
  if (entries == null) {
    return {
      ok: false,
      detail: '无法列举 APK 内原生库（需要 unzip 或 zipinfo）'
    }
  }
  const abis = abisFromVecLibEntries(entries)
  if (!devicePrimaryAbi) {
    return { ok: abis.length > 0, detail: `APK 含 vec.so ABI: ${abis.join(', ') || '(无)'}` }
  }
  if (!abis.includes(devicePrimaryAbi)) {
    return {
      ok: false,
      detail: `设备主 ABI=${devicePrimaryAbi}，但 APK 仅有 vec.so: [${abis.join(', ') || '无'}]`
    }
  }
  return {
    ok: true,
    detail: `设备 ABI=${devicePrimaryAbi}，APK 已含 lib/${devicePrimaryAbi}/${VEC_SO_NAME}`
  }
}

// --- main ---

log('检查宿主侧 sqlite-vec 预置…')
const host = checkHostVecArtifacts()
if (!host.ok) {
  for (const issue of host.issues) warn(`× ${issue}`)
  console.error(
    '[ensure-mobile-native] 宿主侧原生预置不完整。请确认 app.json 插件与 pnpm install，必要时 pnpm mobile:setup。'
  )
  process.exit(1)
}
log(`宿主预置 OK（ABI: ${host.presentAbis.join(', ')}）`)

const localApk = findLocalDebugApk()
if (localApk) {
  const localCheck = checkApkCoversDevice(localApk, null)
  if (localCheck.ok) {
    log(`本地 debug APK 含 vec.so（${localApk}）`)
  } else {
    warn(`本地 debug APK 检查：${localCheck.detail}`)
  }
}

if (!hasAdbDevice()) {
  log('未连接 adb 设备，跳过真机 ABI 探测（CI/无手机时正常）')
  process.exit(0)
}

log('通过 adb 读取设备 ABI…')
let device
try {
  device = getDeviceAbis()
} catch (e) {
  warn(`adb getprop 失败: ${e instanceof Error ? e.message : String(e)}`)
  process.exit(0)
}
log(`设备主 ABI=${device.primary || '?'}；abilist=${device.list.join(',') || '(空)'}`)

let pulled = null
try {
  pulled = pullInstalledDevApk()
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  if (/Unknown package|not found|No such file/i.test(msg) || !msg) {
    warn(
      `未安装 ${ANDROID_DEV_PACKAGE_ID}。日常请先 pnpm dev:mobile:clear；仅改 JS 则用已装开发版 + pnpm dev:mobile。`
    )
    if (AUTO_REBUILD) {
      process.exit(triggerAutoRebuild() ? 0 : 1)
    }
    process.exit(0)
  }
  warn(`拉取已装 APK 失败: ${msg}`)
  process.exit(0)
}

try {
  const installedCheck = checkApkCoversDevice(pulled.localApk, device.primary)
  if (installedCheck.ok) {
    log(`真机开发版原生就绪（${installedCheck.detail}）`)
    process.exit(0)
  }

  warn(`真机开发版与设备 ABI 不匹配：${installedCheck.detail}`)
  warn('请执行: pnpm dev:mobile:clear 重编安装开发版 APK')
  if (AUTO_REBUILD) {
    process.exit(triggerAutoRebuild() ? 0 : 1)
  }
  // 真机不匹配视为失败，避免带着坏 APK 继续开发
  process.exit(1)
} finally {
  if (pulled?.dir) {
    try {
      rmSync(pulled.dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}
