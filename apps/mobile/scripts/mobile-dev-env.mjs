#!/usr/bin/env node
import { execSync } from 'node:child_process'
import {
  ANDROID_DEV_PACKAGE_ID,
  ANDROID_RELEASE_PACKAGE_ID,
  installApkViaAdb,
  installReleaseApkViaAdb,
  prepareAndroidInstall,
  printAndroidInstallFailureHelp,
  printReleaseInstallFailureHelp,
  uninstallConflictingPackages
} from './mobile-dev-adb-install.mjs'
import {
  METRO_PORT,
  devClientEnv,
  getDevServerHost,
  getLanIp,
  hasAdbDevice,
  hasAdbReverse,
  isUsableDevHost,
  isWsl,
  setupAdbReverse,
  startReverseKeeper,
  waitForMetro
} from './mobile-dev-host.mjs'

export {
  ANDROID_DEV_PACKAGE_ID,
  ANDROID_RELEASE_PACKAGE_ID,
  METRO_PORT,
  devClientEnv,
  getDevServerHost,
  getLanIp,
  hasAdbDevice,
  hasAdbReverse,
  installApkViaAdb,
  installReleaseApkViaAdb,
  isUsableDevHost,
  isWsl,
  prepareAndroidInstall,
  printAndroidInstallFailureHelp,
  printReleaseInstallFailureHelp,
  setupAdbReverse,
  startReverseKeeper,
  uninstallConflictingPackages,
  waitForMetro
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 结束旧进程，避免 DevLauncher 在 React 上下文未销毁时重启 MainActivity 崩溃 */
export function stopDevClientApp(packageId = ANDROID_DEV_PACKAGE_ID) {
  if (!hasAdbDevice()) return false
  try {
    execSync(`adb shell am force-stop ${packageId}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
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
