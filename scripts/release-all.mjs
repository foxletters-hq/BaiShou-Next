#!/usr/bin/env node
/**
 * 本地一键打正式包：Android APK + Linux AppImage + Windows 安装包。
 * 产物汇总目录见脚本结束时的输出。
 *
 * 注意：Windows 安装包需在 Windows（或配置好 wine 的 Linux）上才能成功；
 * WSL 下若 build:win 失败，可用 git tag 触发 CI，或在 Windows 本机单独执行 pnpm release:desktop:win。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const desktopDist = join(root, 'apps/desktop/dist')
const releaseDir = join(root, 'release')

function runStep(label, cmd, args) {
  console.log(`\n${'═'.repeat(60)}\n▶ ${label}\n${'═'.repeat(60)}\n`)
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  return result.status === 0
}

function listArtifacts(dir, patterns) {
  if (!existsSync(dir)) return []
  const names = readdirSync(dir)
  return names.filter((name) => patterns.some((re) => re.test(name))).map((name) => join(dir, name))
}

console.log(`
白守 Next — 正式打包（Android + Linux + Windows）
`)

const steps = [
  ['同步版本号', process.execPath, [join(root, 'scripts/sync-app-version.mjs')]],
  ['Android 签名配置', process.execPath, [join(root, 'scripts/setup-android-signing.mjs')]],
  ['Android Release APK', 'pnpm', ['--filter', '@baishou/mobile', 'build:release']],
  ['Linux AppImage', 'pnpm', ['--filter', '@baishou/desktop', 'build:linux']],
  ['Windows 安装包', 'pnpm', ['--filter', '@baishou/desktop', 'build:win']]
]

const failed = []
for (const [label, cmd, args] of steps) {
  if (!runStep(label, cmd, args)) {
    failed.push(label)
    if (label === 'Windows 安装包' && process.platform !== 'win32') {
      console.error(
        '\n⚠️  Windows 包在非 Windows 环境常因缺少 wine/NSIS 失败；Android/Linux 若已成功可忽略，或改在 Windows 执行 pnpm release:desktop:win'
      )
    }
  }
}

const androidApks = listArtifacts(releaseDir, [/Android\.apk$/i])
const linuxImages = listArtifacts(desktopDist, [/\.AppImage$/i])
const winInstallers = listArtifacts(desktopDist, [/setup\.exe$/i])

console.log(`\n${'═'.repeat(60)}`)
console.log('📦 打包产物位置')
console.log('═'.repeat(60))
console.log('\nAndroid（正式签名）:')
console.log(`  目录: ${releaseDir}/`)
for (const f of androidApks) console.log(`  - ${f}`)
if (androidApks.length === 0) console.log('  （未生成）')

console.log('\nLinux / Windows（Electron）:')
console.log(`  目录: ${desktopDist}/`)
for (const f of [...linuxImages, ...winInstallers]) console.log(`  - ${f}`)
if (linuxImages.length === 0 && winInstallers.length === 0) console.log('  （未生成）')

if (failed.length > 0) {
  console.error(`\n❌ 以下步骤失败: ${failed.join('、')}`)
  process.exit(1)
}

console.log('\n✅ 全部打包完成\n')
