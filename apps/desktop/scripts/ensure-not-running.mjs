#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- 纯 .mjs 构建脚本，无 TS 类型注解 */
/**
 * 打包前结束会锁定原生模块或 dist 目录的进程：
 * - BaiShou.exe（已安装/解压版）
 * - 本仓库 electron.exe（dev / preview，会占用 better_sqlite3.node）
 */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32') {
  process.exit(0)
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..')
const spawnOpts = { encoding: 'utf8', windowsHide: true, timeout: 15_000 }

function killByImageName(imageName, label) {
  const listed = spawnSync('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/NH'], spawnOpts)
  const output = `${listed.stdout ?? ''}${listed.stderr ?? ''}`
  if (!new RegExp(imageName.replace('.', '\\.'), 'i').test(output)) {
    return false
  }

  console.log(`[ensure-not-running] 检测到 ${label}，正在结束…`)
  const result = spawnSync('taskkill', ['/F', '/IM', imageName, '/T'], spawnOpts)
  const killOutput = `${result.stdout ?? ''}${result.stderr ?? ''}`

  if (result.error?.code === 'ETIMEDOUT') {
    console.warn(`[ensure-not-running] 结束 ${label} 超时（15s），请手动结束后再打包。`)
  } else if (result.status === 0) {
    console.log(`[ensure-not-running] 已结束 ${label}`)
  } else if (/not found|没有找到|no running instance/i.test(killOutput)) {
    // 进程已退出
  } else {
    console.warn(
      `[ensure-not-running] 未能自动结束 ${label}；若打包报 EPERM/Access denied，请手动结束后再试。`
    )
    if (killOutput.trim()) console.warn(killOutput.trim())
  }
  return true
}

function killProjectElectronProcesses() {
  const ps = [
    '$root = [System.IO.Path]::GetFullPath($args[0])',
    'Get-CimInstance Win32_Process -Filter "name=\'electron.exe\'" -ErrorAction SilentlyContinue |',
    'Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) } |',
    'ForEach-Object { $_.ProcessId }'
  ].join(' ')

  const listed = spawnSync('powershell', ['-NoProfile', '-Command', ps, repoRoot], spawnOpts)
  const pids = `${listed.stdout ?? ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\d+$/.test(line))

  if (pids.length === 0) return false

  console.log(`[ensure-not-running] 检测到 ${pids.length} 个本仓库 electron 进程，正在结束…`)
  for (const pid of pids) {
    spawnSync('taskkill', ['/F', '/PID', pid, '/T'], spawnOpts)
  }
  console.log('[ensure-not-running] 已结束本仓库 electron 进程')
  return true
}

const killedBaiShou = killByImageName('BaiShou.exe', 'BaiShou.exe')
const killedElectron = killProjectElectronProcesses()
const killed = killedBaiShou || killedElectron

if (killed) {
  spawnSync('powershell', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 800'], {
    windowsHide: true,
    timeout: 5_000
  })
}

// 打包时若仍占用 better_sqlite3.node，给出明确指引（安装器侧另有交互式提示）
const stillListed = spawnSync('tasklist', ['/FI', 'IMAGENAME eq BaiShou.exe', '/NH'], spawnOpts)
const stillOutput = `${stillListed.stdout ?? ''}${stillListed.stderr ?? ''}`
if (/BaiShou\.exe/i.test(stillOutput)) {
  console.warn(
    '[ensure-not-running] BaiShou.exe 仍在运行。请手动退出白守（含托盘）后再打包，否则可能 EPERM 占用原生模块。'
  )
  if (process.env.BAISHOU_REQUIRE_QUIT === '1' || process.env.BAISHOU_REQUIRE_QUIT === 'true') {
    process.exit(1)
  }
}

process.exit(0)
