#!/usr/bin/env node
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

/** Metro file-map 磁盘缓存在 /tmp；Node 升级或中断构建后可能无法反序列化 */
function rmMetroTmpCaches() {
  const tmpDir = os.tmpdir()
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

console.log('\n🧹 清理移动端构建缓存…\n')
for (const target of targets) {
  rm(target)
}
rmMetroTmpCaches()
console.log('\n完成。\n')
