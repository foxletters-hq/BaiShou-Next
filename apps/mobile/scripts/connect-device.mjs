#!/usr/bin/env node
/**
 * 不启动 Metro，仅：adb reverse + 在真机打开开发版（Metro 需已在另一终端 pnpm dev:mobile）
 */
import {
  METRO_PORT,
  getLanIp,
  hasAdbDevice,
  openDevClientOnDevice,
  printDevConnectionHelp,
  setupAdbReverse
} from './mobile-dev-env.mjs'

const host = getLanIp()

if (!hasAdbDevice()) {
  console.error('\n❌ 未检测到 adb 设备。请 USB 连接手机并开启 USB 调试。\n')
  printDevConnectionHelp(host, METRO_PORT)
  process.exit(1)
}

setupAdbReverse(METRO_PORT)
printDevConnectionHelp(host, METRO_PORT)

try {
  openDevClientOnDevice(host, METRO_PORT)
} catch (e) {
  console.error('打开失败:', e.message)
  process.exit(1)
}
