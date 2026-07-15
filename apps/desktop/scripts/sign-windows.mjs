#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- desktop build script（.mjs） */
/**
 * Windows Authenticode 签名（可选）。
 *
 * 环境变量（任选一种证书来源）：
 * - WINDOWS_CERT_FILE + WINDOWS_CERT_PASSWORD  （本机 PFX 路径）
 * - WINDOWS_CERT_PFX_BASE64 + WINDOWS_CERT_PASSWORD  （CI：Base64 编码的 PFX）
 *
 * 可选：
 * - WINDOWS_CERT_TIMESTAMP_URL  （默认 DigiCert）
 * - WINDOWS_SIGN_REQUIRED=1     （未配置证书或签名失败时退出非 0）
 *
 * 用法：
 *   node scripts/sign-windows.mjs <file1> [file2...]
 *   node scripts/sign-windows.mjs --unpacked   # 签名 dist/win-unpacked 内主程序
 */
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_TIMESTAMP = 'http://timestamp.digicert.com'

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`[sign-windows] ${message}`)
  process.exit(1)
}

/** @returns {boolean} */
function signRequired() {
  return process.env.WINDOWS_SIGN_REQUIRED === '1' || process.env.WINDOWS_SIGN_REQUIRED === 'true'
}

/** @returns {string | null} */
function resolveSignTool() {
  const fromEnv = process.env.SIGNTOOL?.trim()
  if (fromEnv && existsSync(fromEnv)) return fromEnv

  const where = spawnSync('where', ['signtool.exe'], { shell: true, encoding: 'utf8' })
  if (where.status === 0) {
    const found = where.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean)
    if (found && existsSync(found)) return found
  }

  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const kitsBin = join(pf86, 'Windows Kits', '10', 'bin')
  if (!existsSync(kitsBin)) return null

  /** @type {{ path: string, mtime: number }[]} */
  const found = []
  for (const name of readdirSync(kitsBin)) {
    const x64 = join(kitsBin, name, 'x64', 'signtool.exe')
    if (!existsSync(x64)) continue
    let mtime = 0
    try {
      mtime = statSync(x64).mtimeMs
    } catch {
      /* ignore */
    }
    found.push({ path: x64, mtime })
  }
  found.sort((a, b) => b.mtime - a.mtime)
  return found[0]?.path ?? null
}

/** @returns {{ pfxPath: string, password: string, cleanup: () => void } | null} */
function resolveCertificate() {
  const password = process.env.WINDOWS_CERT_PASSWORD?.trim() ?? ''
  const file = process.env.WINDOWS_CERT_FILE?.trim()
  if (file) {
    if (!existsSync(file)) {
      fail(`WINDOWS_CERT_FILE 不存在: ${file}`)
    }
    if (!password) {
      fail('已设置 WINDOWS_CERT_FILE，但缺少 WINDOWS_CERT_PASSWORD')
    }
    return { pfxPath: file, password, cleanup: () => {} }
  }

  const b64 = process.env.WINDOWS_CERT_PFX_BASE64?.trim()
  if (b64) {
    if (!password) {
      fail('已设置 WINDOWS_CERT_PFX_BASE64，但缺少 WINDOWS_CERT_PASSWORD')
    }
    const dir = mkdtempSync(join(tmpdir(), 'baishou-win-cert-'))
    const pfxPath = join(dir, 'codesign.pfx')
    writeFileSync(pfxPath, Buffer.from(b64.replace(/\s+/g, ''), 'base64'))
    return {
      pfxPath,
      password,
      cleanup: () => {
        try {
          rmSync(dir, { recursive: true, force: true })
        } catch {
          /* ignore */
        }
      }
    }
  }

  return null
}

/** @param {string} signtool @param {string} pfxPath @param {string} password @param {string} filePath */
function signOne(signtool, pfxPath, password, filePath) {
  if (!existsSync(filePath)) {
    fail(`待签名文件不存在: ${filePath}`)
  }

  const timestamp = process.env.WINDOWS_CERT_TIMESTAMP_URL?.trim() || DEFAULT_TIMESTAMP
  const args = [
    'sign',
    '/f',
    pfxPath,
    '/p',
    password,
    '/fd',
    'SHA256',
    '/td',
    'SHA256',
    '/tr',
    timestamp,
    '/d',
    'BaiShou',
    filePath
  ]

  console.log(`[sign-windows] 签名: ${filePath}`)
  const result = spawnSync(signtool, args, { stdio: 'inherit', windowsHide: true })
  if (result.status !== 0) {
    fail(`signtool 失败（退出码 ${result.status ?? 'unknown'}）: ${filePath}`)
  }
}

/** @returns {string[]} */
function collectUnpackedTargets() {
  const unpacked = join(desktopRoot, 'dist', 'win-unpacked')
  return [join(unpacked, 'BaiShou.exe')].filter((p) => existsSync(p))
}

function main() {
  if (process.platform !== 'win32') {
    if (signRequired()) fail('Windows 签名仅能在 Windows 上执行')
    console.log('[sign-windows] 非 Windows，跳过')
    return
  }

  const args = process.argv.slice(2)
  const unpackedMode = args.includes('--unpacked')
  const files = unpackedMode
    ? collectUnpackedTargets()
    : args.filter((a) => a !== '--unpacked' && !a.startsWith('-'))

  const cert = resolveCertificate()
  if (!cert) {
    const msg =
      '[sign-windows] 未配置 Windows 代码签名证书（WINDOWS_CERT_FILE 或 WINDOWS_CERT_PFX_BASE64），跳过签名。' +
      ' 未签名安装包会触发 SmartScreen「未知发布者」警告；正式发版请配置 OV/EV 证书。'
    if (signRequired()) fail(msg)
    console.warn(msg)
    return
  }

  try {
    const signtool = resolveSignTool()
    if (!signtool) {
      fail(
        '未找到 signtool.exe。请安装 Windows SDK，或设置 SIGNTOOL 指向 signtool.exe。\n' +
          '  例: C:\\Program Files (x86)\\Windows Kits\\10\\bin\\10.0.xxxxx.0\\x64\\signtool.exe'
      )
    }

    if (files.length === 0) {
      fail('未指定待签名文件。用法: node scripts/sign-windows.mjs <file...> 或 --unpacked')
    }

    console.log(`[sign-windows] signtool: ${signtool}`)
    for (const file of files) {
      signOne(signtool, cert.pfxPath, cert.password, file)
    }
    console.log(`[sign-windows] 完成，共 ${files.length} 个文件`)
  } finally {
    cert.cleanup()
  }
}

main()
