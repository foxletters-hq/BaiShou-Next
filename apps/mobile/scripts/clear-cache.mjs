#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(mobileRoot, '../..')

const targets = [
  path.join(mobileRoot, '.expo'),
  path.join(mobileRoot, 'node_modules', '.cache'),
  path.join(workspaceRoot, 'node_modules', '.cache'),
  path.join(workspaceRoot, '.turbo'),
  path.join(mobileRoot, 'android', 'app', 'build'),
  path.join(mobileRoot, 'android', 'build')
]

function rm(target) {
  if (!fs.existsSync(target)) return
  fs.rmSync(target, { recursive: true, force: true })
  console.log(`  ✓ 已删除 ${path.relative(workspaceRoot, target)}`)
}

/** 先停 daemon，避免删掉 android 的 build 目录后增量打包还握着旧 zip-cache，触发 packageDebug IncrementalSplitter 失败 */
function stopGradleDaemon() {
  const androidDir = path.join(mobileRoot, 'android')
  const gradlew = path.join(androidDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
  if (!fs.existsSync(gradlew)) return
  const result = spawnSync(gradlew, ['--stop'], {
    cwd: androidDir,
    encoding: 'utf8',
    timeout: 60_000
  })
  if (result.status === 0) {
    console.log('  ✓ 已停止 Gradle daemon')
  }
}

/** worklets 编译缓存与 Metro 不同步时会 ENOENT；清空后需保留空目录供 Metro 重建 */
function resetWorkletsCache() {
  const workletsDir = path.join(workspaceRoot, 'node_modules', 'react-native-worklets', '.worklets')
  rm(workletsDir)
  fs.mkdirSync(workletsDir, { recursive: true })
  console.log(`  ✓ 已重置 ${path.relative(workspaceRoot, workletsDir)}`)
}

/** Metro file-map / transform 磁盘缓存在 /tmp；Node 升级、中断构建或清空 .worklets 后可能仍引用已删文件 */
function rmMetroTmpCaches() {
  const tmpDir = os.tmpdir()

  const exactNames = ['metro-cache', 'haste-map']
  for (const name of exactNames) {
    const fullPath = path.join(tmpDir, name)
    try {
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true })
        console.log(`  ✓ 已删除 ${fullPath}`)
      }
    } catch {
      // ignore locked tmp files
    }
  }

  let names
  try {
    names = fs.readdirSync(tmpDir)
  } catch {
    return
  }

  const prefixes = ['metro-file-map-', 'metro-cache-', 'haste-map-']
  for (const name of names) {
    if (!prefixes.some((prefix) => name.startsWith(prefix))) continue
    const fullPath = path.join(tmpDir, name)
    try {
      fs.rmSync(fullPath, { recursive: true, force: true })
      console.log(`  ✓ 已删除 ${fullPath}`)
    } catch {
      // ignore locked tmp files
    }
  }
}

function clearAllMobileCaches() {
  console.log('\n🧹 清理移动端构建缓存…\n')
  stopGradleDaemon()
  for (const target of targets) {
    rm(target)
  }
  resetWorkletsCache()
  rmMetroTmpCaches()
  console.log('\n完成。\n')
}

export { resetWorkletsCache, rmMetroTmpCaches, rm, clearAllMobileCaches }

const isMain = path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)
if (isMain) {
  clearAllMobileCaches()
}
