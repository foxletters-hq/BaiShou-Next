#!/usr/bin/env node
import { execSync } from 'node:child_process'
import os from 'node:os'

/** 与 expo run:android 默认一致，避免 dev 与 android 端口不一致 */
export const METRO_PORT = process.env.RCT_METRO_PORT || '8081'

export function getLanIp() {
  try {
    const out = execSync(
      'ip route get 1.1.1.1 2>/dev/null | awk \'{for(i=1;i<=NF;i++) if($i=="src") print $(i+1)}\'',
      { encoding: 'utf8' }
    ).trim()
    if (out) return out
  } catch {
    /* ignore */
  }

  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal &&
        (iface.address.startsWith('192.168.') || iface.address.startsWith('10.'))
      ) {
        return iface.address
      }
    }
  }

  return '127.0.0.1'
}

export function hasAdbDevice() {
  try {
    const out = execSync('adb devices', { encoding: 'utf8' })
    return out.split('\n').some((line) => line.trim().endsWith('\tdevice'))
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

export function openDevClientOnDevice(host = getLanIp(), port = METRO_PORT) {
  const bundleUrl = `http://${host}:${port}`
  const deepLink = `mobile://expo-development-client/?url=${encodeURIComponent(bundleUrl)}`
  execSync(`adb shell am start -a android.intent.action.VIEW -d "${deepLink}"`, {
    stdio: 'inherit'
  })
  console.log(`\n📱 已在真机打开开发客户端 → ${bundleUrl}\n`)
}
