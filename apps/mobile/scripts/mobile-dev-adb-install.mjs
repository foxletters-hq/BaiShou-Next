import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { getLanIp, hasAdbDevice } from './mobile-dev-host.mjs'

export const ANDROID_RELEASE_PACKAGE_ID = 'com.baishou.baishou'
export const ANDROID_DEV_PACKAGE_ID = 'com.baishou.baishou.dev'
const ANDROID_PACKAGE_ID = ANDROID_DEV_PACKAGE_ID
/** 历史包名，与当前 debug 签名不同，冲突时需一并卸载 */
const LEGACY_ANDROID_PACKAGE_IDS = ['com.anonymous.mobile']

const ADB_INSTALL_FLAGS = '-r -d -t'
const REMOTE_APK_PATH = '/data/local/tmp/baishou-app-debug.apk'
const REMOTE_RELEASE_APK_PATH = '/data/local/tmp/baishou-app-release.apk'
const HTTP_INSTALL_PORT = 18765

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

function tryStreamedInstall(absApk) {
  try {
    adbExec(`adb install ${ADB_INSTALL_FLAGS} "${absApk}"`)
    return { ok: true, method: 'streamed' }
  } catch (err) {
    return { ok: false, err: adbExecErrorText(err) }
  }
}

function tryPushInstall(absApk, remotePath = REMOTE_APK_PATH) {
  try {
    adbExec(`adb push "${absApk}" ${remotePath}`)
    const out = adbExec(`adb shell pm install ${ADB_INSTALL_FLAGS} ${remotePath}`)
    if (!out.includes('Success')) {
      return { ok: false, err: out.trim() || 'pm install 未返回 Success' }
    }
    return { ok: true, method: 'push' }
  } catch (err) {
    return { ok: false, err: adbExecErrorText(err) }
  } finally {
    try {
      adbExec(`adb shell rm -f ${remotePath}`)
    } catch {
      /* ignore */
    }
  }
}

/** 无线 adb 传大 APK 常失败；手机经局域网 curl 下载后 pm install（WSL2 + 小米更稳） */
function tryHttpInstall(absApk, remotePath = REMOTE_APK_PATH) {
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

    adbExec(`adb shell "curl -f -o ${remotePath} '${url}'"`)
    const out = adbExec(`adb shell pm install ${ADB_INSTALL_FLAGS} ${remotePath}`)
    if (!out.includes('Success')) {
      return { ok: false, err: out.trim() || 'pm install 未返回 Success' }
    }
    return { ok: true, method: 'http' }
  } catch (err) {
    return { ok: false, err: adbExecErrorText(err) }
  } finally {
    server.kill('SIGTERM')
    try {
      adbExec(`adb shell rm -f ${remotePath}`)
    } catch {
      /* ignore */
    }
  }
}

function installOnce(absApk, remotePath = REMOTE_APK_PATH) {
  const streamed = tryStreamedInstall(absApk)
  if (streamed.ok) return streamed
  const pushed = tryPushInstall(absApk, remotePath)
  if (pushed.ok) return pushed
  const http = tryHttpInstall(absApk, remotePath)
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

/** 安装正式版 APK（com.baishou.baishou）；签名冲突时卸载旧正式包后重试 */
export function installReleaseApkViaAdb(apkPath) {
  const absApk = path.resolve(apkPath)
  if (!fs.existsSync(absApk)) {
    throw new Error(`找不到 APK: ${absApk}`)
  }
  if (!hasAdbDevice()) {
    throw new Error('未检测到 adb 设备')
  }

  prepareAndroidInstall(ANDROID_RELEASE_PACKAGE_ID)

  let result = installOnce(absApk, REMOTE_RELEASE_APK_PATH)
  if (!result.ok && isSignatureMismatchError(result.err)) {
    console.log('\n⚠️  检测到旧版正式包签名不一致，正在卸载后重试…\n')
    try {
      const out = adbExec(`adb uninstall ${ANDROID_RELEASE_PACKAGE_ID}`)
      if (out.includes('Success')) {
        console.log(`📲 已卸载 ${ANDROID_RELEASE_PACKAGE_ID}`)
      }
    } catch {
      /* 未安装 */
    }
    result = installOnce(absApk, REMOTE_RELEASE_APK_PATH)
  }

  if (!result.ok) {
    throw new Error(result.err || 'adb 安装失败')
  }
  return result.method
}

/** 正式版安装失败时的排查提示 */
export function printReleaseInstallFailureHelp(apkPath, lastError = '') {
  const signatureHint = isSignatureMismatchError(lastError)
    ? `
⚠️  本次为签名冲突：请先卸载旧正式版再装：
     adb uninstall ${ANDROID_RELEASE_PACKAGE_ID}
     pnpm mobile:install:release
`
    : ''

  console.error(`
❌ 正式版 APK 安装失败
${signatureHint}
建议：
  1. 保持手机解锁、亮屏
  2. 卸载冲突包后重装：
     adb uninstall ${ANDROID_RELEASE_PACKAGE_ID}
     pnpm mobile:install:release
  3. 若无 APK，先构建：pnpm release:android

手动安装：
  adb push "${apkPath}" ${REMOTE_RELEASE_APK_PATH}
  adb shell pm install ${ADB_INSTALL_FLAGS} ${REMOTE_RELEASE_APK_PATH}
`)
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
  · 旧包签名不同（旧 Expo 包 com.anonymous.mobile）
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
