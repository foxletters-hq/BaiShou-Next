#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- desktop build script（.mjs） */
/**
 * 在 electron-builder --dir 产出 win-unpacked 后，用 Inno Setup 打 Windows 安装包。
 * 需已安装 Inno Setup 6（ISCC.exe）；CI 通过 choco install innosetup 提供。
 */
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const unpackedDir = join(desktopRoot, 'dist', 'win-unpacked')
const setupIss = join(desktopRoot, 'setup.iss')

/** @returns {void} */
function runVerifyPack() {
  const verify = join(desktopRoot, 'scripts', 'verify-desktop-pack.mjs')
  const result = spawnSync(process.execPath, [verify], {
    cwd: desktopRoot,
    stdio: 'inherit'
  })
  if (result.status !== 0) {
    fail('verify-desktop-pack 未通过，已中止 Inno 编译（避免把旧/坏产物打进安装包）')
  }
}

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`[build-inno] ${message}`)
  process.exit(1)
}

/** @returns {string} */
function readVersion() {
  const manifestPath = join(desktopRoot, 'src', 'version.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const raw = String(manifest.version ?? '').trim()
  const match = raw.match(/(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/)
  if (!match) {
    fail(`无效版本号: ${raw}（见 src/version.json）`)
  }
  return match[1]
}

/** @returns {string | null} */
function resolveIscc() {
  const fromEnv = process.env.ISCC?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const candidates = [
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe'
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }

  const where = spawnSync('where', ['ISCC.exe'], { shell: true, encoding: 'utf8' })
  if (where.status === 0) {
    const found = where.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
    if (found && existsSync(found)) return found
  }

  return null
}

if (process.platform !== 'win32') {
  fail(
    'Inno Setup 仅支持在 Windows 上编译。请在本机 Windows 执行。'
  )
}

if (!existsSync(unpackedDir)) {
  fail(`未找到 ${unpackedDir}，请先执行: npm run build:unpack`)
}

const exePath = join(unpackedDir, 'BaiShou.exe')
if (!existsSync(exePath)) {
  fail(`未找到 ${exePath}，请确认 electron-builder --dir 已成功完成。`)
}

runVerifyPack()

const iconPath = join(desktopRoot, 'dist', '.icon-ico', 'icon.ico')
if (!existsSync(iconPath)) {
  fail(`未找到 ${iconPath}，请确认 electron-builder --dir 已生成安装图标。`)
}

const version = readVersion()
const outputBase = `BaiShou-v${version}-Windows-Setup`
const iscc = resolveIscc()
if (!iscc) {
  fail(
    '未找到 ISCC.exe。请安装 Inno Setup 6: https://jrsoftware.org/isinfo.php\n' +
      '  或: choco install innosetup -y'
  )
}

console.log(`[build-inno] 版本: ${version}`)
console.log(`[build-inno] 编译器: ${iscc}`)
console.log(`[build-inno] 输出: dist/${outputBase}.exe`)

const result = spawnSync(
  iscc,
  [
    `/DAppVersion=${version}`,
    `/DOutputBaseFilename=${outputBase}`,
    `/DSetupIconPath=${iconPath}`,
    setupIss
  ],
  { cwd: desktopRoot, stdio: 'inherit' }
)

if (result.status !== 0) {
  fail(`ISCC 编译失败（退出码 ${result.status ?? 'unknown'}）`)
}

const installerPath = join(desktopRoot, 'dist', `${outputBase}.exe`)
if (!existsSync(installerPath)) {
  fail(`编译完成但未找到安装包: ${installerPath}`)
}

console.log(`[build-inno] 完成: ${installerPath}`)
