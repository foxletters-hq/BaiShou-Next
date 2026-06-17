#!/usr/bin/env node
/**
 * electron-builder --dir 会清空 dist/win-unpacked；若 BaiShou.exe 仍在运行会 Access denied。
 */
import { spawnSync } from 'node:child_process'

if (process.platform !== 'win32') {
  process.exit(0)
}

const spawnOpts = { encoding: 'utf8', windowsHide: true, timeout: 15_000 }

const listed = spawnSync('tasklist', ['/FI', 'IMAGENAME eq BaiShou.exe', '/NH'], spawnOpts)
const output = `${listed.stdout ?? ''}${listed.stderr ?? ''}`
if (!/BaiShou\.exe/i.test(output)) {
  process.exit(0)
}

console.log('[ensure-not-running] 检测到 BaiShou.exe，正在结束…')
const result = spawnSync('taskkill', ['/F', '/IM', 'BaiShou.exe', '/T'], spawnOpts)

const killOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`
if (result.error?.code === 'ETIMEDOUT') {
  console.warn(
    '[ensure-not-running] taskkill 超时（15s）。请在任务管理器中手动结束 BaiShou.exe 后再打包。'
  )
} else if (result.status === 0) {
  console.log('[ensure-not-running] 已结束正在运行的 BaiShou.exe')
} else if (/not found|没有找到|no running instance/i.test(killOutput)) {
  // 进程已退出
} else {
  console.warn(
    '[ensure-not-running] 未能自动结束 BaiShou.exe；若打包报 Access denied，请在任务管理器中手动结束后再试。'
  )
  if (killOutput.trim()) console.warn(killOutput.trim())
}

process.exit(0)
