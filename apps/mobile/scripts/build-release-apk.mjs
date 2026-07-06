#!/usr/bin/env node
/**
 * 构建 Android Release APK（正式签名，可覆盖旧 Flutter 版）。
 * 前置：apps/mobile/android/key.properties 已配置（pnpm release:setup-signing）
 *
 * 环境变量：
 * - CI=true（GitHub Actions 自动设置）：跳过全量清缓存、启用 Gradle 构建缓存
 * - SKIP_SYNC=1：跳过 sync（workflow 已执行时）
 * - BAISHOU_RELEASE_FULL_CLEAN=1：强制全量清缓存 + --no-build-cache（排查陈旧产物时用）
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { applyAndroidPlainSplashPatch } from './plain-splash-patch.mjs'
import { clearAllMobileCaches } from './clear-cache.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(mobileRoot, '../..')
const keyProperties = path.join(mobileRoot, 'android/key.properties')
const androidDir = path.join(mobileRoot, 'android')
const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')

const isCi = process.env.CI === 'true'
const forceFullClean = process.env.BAISHOU_RELEASE_FULL_CLEAN === '1'
const skipSync = process.env.SKIP_SYNC === '1'

const diaryEditorBundle = path.join(mobileRoot, 'assets/diary-editor/diary-editor.bundle')
const diaryEditorHtml = path.join(mobileRoot, 'assets/diary-editor/index.html')
const MIN_DIARY_EDITOR_BUNDLE_BYTES = 100_000

function assertDiaryEditorBundleReady() {
  for (const filePath of [diaryEditorHtml, diaryEditorBundle]) {
    if (!existsSync(filePath)) {
      console.error(`❌ 缺少日记编辑器 WebView 资源: ${filePath}`)
      console.error('   请先执行: cd apps/mobile && pnpm run build:diary-editor')
      process.exit(1)
    }
  }
  const bundleSize = statSync(diaryEditorBundle).size
  if (bundleSize < MIN_DIARY_EDITOR_BUNDLE_BYTES) {
    console.error(`❌ diary-editor.bundle 过小（${bundleSize} bytes），请重新 build:diary-editor`)
    process.exit(1)
  }
}

function buildDiaryEditorBundle() {
  console.log('\n📦 打包 diary-editor WebView bundle（Release 必须与主包同步）…')
  run('pnpm', ['run', 'build:diary-editor'], mobileRoot)
  assertDiaryEditorBundleReady()
}

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

if (!skipSync) {
  console.log('🎨 同步生成物…')
  run(process.execPath, [path.join(repoRoot, 'scripts/sync-all.mjs')], repoRoot)
} else {
  console.log('🎨 跳过 sync（已由上层步骤执行）')
}

if (forceFullClean || !isCi) {
  console.log('\n🧹 清理移动端构建缓存（避免 Release 包沿用旧 JS bundle）…')
  clearAllMobileCaches()
} else {
  console.log('\n🧹 CI：跳过全量清缓存（干净 checkout，保留 Gradle 缓存加速）')
}

buildDiaryEditorBundle()

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

const gradleArgs = [':app:assembleRelease']
if (forceFullClean) {
  gradleArgs.push('--no-build-cache')
  console.log('\n🔨 assembleRelease（强制全量，无构建缓存）…')
} else if (isCi) {
  console.log('\n🔨 assembleRelease（CI：启用 Gradle 构建缓存）…')
} else {
  console.log('\n🔨 assembleRelease…')
}
run(gradlew, gradleArgs, androidDir)

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
