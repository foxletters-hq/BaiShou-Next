#!/usr/bin/env node
/**
 * 构建 Android Release APK（正式签名，可覆盖旧 Flutter 版）。
 * 前置：apps/mobile/android/key.properties 已配置（pnpm release:setup-signing）
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyAndroidPlainSplashPatch } from './plain-splash-patch.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(mobileRoot, '../..')
const keyProperties = path.join(mobileRoot, 'android/key.properties')
const androidDir = path.join(mobileRoot, 'android')
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')

function run(cmd, args, cwd, extraEnv = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, ...extraEnv }
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

if (!existsSync(keyProperties)) {
  console.error('❌ 缺少 apps/mobile/android/key.properties')
  console.error('   请先执行（仓库根目录）: pnpm release:setup-signing')
  process.exit(1)
}

console.log('🎨 同步应用图标…')
run(process.execPath, [path.join(repoRoot, 'scripts/sync-app-icon.mjs')], repoRoot)

console.log('\n📦 同步应用版本…')
run(process.execPath, [path.join(repoRoot, 'scripts/sync-app-version.mjs')], repoRoot)

console.log('\n🔧 Expo prebuild（注入 release 签名配置）…')
run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], mobileRoot, {
  BAISHOU_RELEASE_BUILD: '1'
})

if (!existsSync(gradlew)) {
  console.error('❌ 未找到 Gradle wrapper，prebuild 可能失败')
  process.exit(1)
}

console.log('\n🎨 应用纯色启动屏补丁…')
applyAndroidPlainSplashPatch(androidDir)

console.log('\n🔨 assembleRelease…')
run(gradlew, [':app:assembleRelease'], androidDir)

const apkSrc = path.join(androidDir, 'app/build/outputs/apk/release/app-release.apk')
if (!existsSync(apkSrc)) {
  console.error('❌ 未找到 release APK:', apkSrc)
  process.exit(1)
}

const version = JSON.parse(readFileSync(path.join(mobileRoot, 'src/version.json'), 'utf8')).version
const outDir = path.join(repoRoot, 'release')
mkdirSync(outDir, { recursive: true })
const apkDest = path.join(outDir, `BaiShou-v${version}-Android.apk`)
copyFileSync(apkSrc, apkDest)

console.log(`\n✅ Release APK: ${apkDest}`)
