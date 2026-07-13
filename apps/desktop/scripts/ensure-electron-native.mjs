#!/usr/bin/env node
/**
 * 桌面启动前：确认 better-sqlite3（及 sqlite-vec）已按当前 Electron ABI 编译。
 * 若 NODE_MODULE_VERSION 不匹配（常见于 ci:check / `pnpm rebuild` 按系统 Node 重编后），
 * 自动执行 electron-rebuild，避免 dev 启动后再炸。
 *
 * 探测在真实 Electron 主进程中 require（显式关闭 ELECTRON_RUN_AS_NODE）。
 * Windows 下 Electron 常不继承控制台，故结果写入临时文件再回读。
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const desktopPkg = join(desktopRoot, 'package.json')
const requireFromDesktop = createRequire(desktopPkg)

function resolveElectronBinary() {
  try {
    return requireFromDesktop('electron')
  } catch {
    return null
  }
}

/** @returns {{ ok: boolean, detail: string }} */
function probeNativeUnderElectron(electronBin) {
  const dir = mkdtempSync(join(tmpdir(), 'baishou-native-probe-'))
  const mainFile = join(dir, 'main.cjs')
  const resultFile = join(dir, 'result.json')
  const pkgLiteral = JSON.stringify(desktopPkg)
  const resultLiteral = JSON.stringify(resultFile)

  writeFileSync(
    mainFile,
    `
const { createRequire } = require('module');
const { writeFileSync } = require('fs');
const { app } = require('electron');
const requireFromDesktop = createRequire(${pkgLiteral});
const resultPath = ${resultLiteral};

function writeResult(payload) {
  try {
    writeFileSync(resultPath, JSON.stringify(payload));
  } catch (_) {}
}

app.whenReady().then(() => {
  try {
    // 打开内存库，确保真正 dlopen 原生 .node（仅 require 有时不够触发 ABI 检查）
    const Database = requireFromDesktop('better-sqlite3');
    const db = new Database(':memory:');
    db.close();
    try { requireFromDesktop('sqlite-vec'); } catch (_) {}
    writeResult({
      ok: true,
      detail: 'ok ' + process.versions.modules + ' ' + (process.versions.electron || '')
    });
    app.exit(0);
  } catch (e) {
    writeResult({
      ok: false,
      detail: String(e && e.message ? e.message : e)
    });
    app.exit(1);
  }
}).catch((e) => {
  writeResult({ ok: false, detail: String(e && e.message ? e.message : e) });
  app.exit(1);
});
`
  )

  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  env.ELECTRON_NO_ATTACH_CONSOLE = '1'

  try {
    spawnSync(electronBin, [mainFile], {
      cwd: desktopRoot,
      encoding: 'utf8',
      env,
      windowsHide: true,
      timeout: 60_000
    })

    try {
      const payload = JSON.parse(readFileSync(resultFile, 'utf8'))
      return {
        ok: Boolean(payload.ok),
        detail: String(payload.detail || '')
      }
    } catch {
      return {
        ok: false,
        detail: '探测未写出结果（Electron 可能未能启动）'
      }
    }
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
}

function rebuildNative() {
  console.log('[ensure-electron-native] 正在按 Electron ABI 重编 better-sqlite3,sqlite-vec…')
  const result = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['run', 'rebuild:native'],
    {
      cwd: desktopRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: process.env
    }
  )
  return result.status === 0
}

const electronBin = resolveElectronBinary()
if (!electronBin) {
  console.error('[ensure-electron-native] 未找到 electron，请先在仓库根执行 pnpm install')
  process.exit(1)
}

const first = probeNativeUnderElectron(electronBin)
if (first.ok) {
  console.log(`[ensure-electron-native] 原生模块就绪（${first.detail}）`)
  process.exit(0)
}

const needsRebuild = /NODE_MODULE_VERSION|was compiled against a different Node\.js version/i.test(
  first.detail
)
if (!needsRebuild) {
  console.error(`[ensure-electron-native] 加载 better-sqlite3 失败：\n${first.detail}`)
  process.exit(1)
}

console.warn(`[ensure-electron-native] ABI 不匹配，将自动重编：\n${first.detail}`)
if (!rebuildNative()) {
  console.error(
    '[ensure-electron-native] electron-rebuild 失败。若提示文件被占用，请先关闭桌面端再试。'
  )
  process.exit(1)
}

const second = probeNativeUnderElectron(electronBin)
if (!second.ok) {
  console.error(`[ensure-electron-native] 重编后仍无法加载：\n${second.detail}`)
  process.exit(1)
}

console.log(`[ensure-electron-native] 重编完成（${second.detail}）`)
process.exit(0)
