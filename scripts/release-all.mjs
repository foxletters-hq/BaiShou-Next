#!/usr/bin/env node
/**
 * 本地一键打官方正式包：Android APK + Windows 安装包。
 * 产物汇总目录见脚本结束时的输出。
 *
 * Linux / WSL / macOS：仅打 Android，跳过 Windows（需 Windows 本机构建 Inno Setup 包）。
 * Windows 安装包请在 Windows 本机执行 pnpm release:desktop:win，或使用 GitHub Actions。
 *
 * 官方不提供 Linux / iOS / macOS 安装包。Linux 自行编译见 pnpm release:desktop:linux（不纳入本脚本）。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const desktopDist = join(root, 'apps/desktop/dist')
const releaseDir = join(root, 'release')
const skipWindowsOnNonWin = process.platform !== 'win32'

function runStep(label, cmd, args) {
  console.log(`\n${'═'.repeat(60)}\n▶ ${label}\n${'═'.repeat(60)}\n`)
  const result = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  return result.status === 0
}

function listArtifacts(dir, patterns) {
  if (!existsSync(dir)) return []
  const names = readdirSync(dir)
  return names.filter((name) => patterns.some((re) => re.test(name))).map((name) => join(dir, name))
}

console.log(`
白守 Next — 官方正式打包（Android + Windows${skipWindowsOnNonWin ? '；当前环境将跳过 Windows' : ''}）
`)

const steps = [
  ['同步应用图标', process.execPath, [join(root, 'scripts/sync-app-icon.mjs')]],
  ['同步版本号', process.execPath, [join(root, 'scripts/sync-app-version.mjs')]],
  ['Android 签名配置', process.execPath, [join(root, 'scripts/setup-android-signing.mjs')]],
  ['Android Release APK', 'pnpm', ['--filter', '@baishou/mobile', 'build:release']],
  ['Windows 安装包', 'pnpm', ['--filter', '@baishou/desktop', 'build:win']]
]

const failed = []
const skipped = []

for (const [label, cmd, args] of steps) {
  if (label === 'Windows 安装包' && skipWindowsOnNonWin) {
    console.log(
      `\n${'═'.repeat(60)}\n▶ ${label}（已跳过）\n${'═'.repeat(60)}\n` +
        '非 Windows 环境不构建官方 Windows 安装包。请在 Windows 本机执行：pnpm release:desktop:win\n'
    )
    skipped.push(label)
    continue
  }

  if (!runStep(label, cmd, args)) {
    failed.push(label)
  }
}

const androidApks = listArtifacts(releaseDir, [/Android\.apk$/i])
const winInstallers = listArtifacts(desktopDist, [/Windows-Setup\.exe$/i])

console.log(`\n${'═'.repeat(60)}`)
console.log('📦 官方打包产物位置')
console.log('═'.repeat(60))
console.log('\nAndroid（正式签名）:')
console.log(`  目录: ${releaseDir}/`)
for (const f of androidApks) console.log(`  - ${f}`)
if (androidApks.length === 0) console.log('  （未生成）')

console.log('\nWindows（Electron）:')
console.log(`  目录: ${desktopDist}/`)
for (const f of winInstallers) console.log(`  - ${f}`)
if (winInstallers.length === 0) console.log('  （未生成）')

if (skipped.length > 0) {
  console.log(`\n⏭️  已跳过: ${skipped.join('、')}`)
}

console.log(
  '\nℹ️  官方不提供 Linux / iOS / macOS 安装包。Linux 自行编译：pnpm release:desktop:linux'
)

if (failed.length > 0) {
  console.error(`\n❌ 以下步骤失败: ${failed.join('、')}`)
  process.exit(1)
}

console.log('\n✅ 全部打包完成\n')
