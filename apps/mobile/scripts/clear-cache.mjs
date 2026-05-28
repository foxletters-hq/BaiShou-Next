#!/usr/bin/env node
import fs from 'node:fs'
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

console.log('\n🧹 清理移动端构建缓存…\n')
for (const target of targets) {
  rm(target)
}
console.log('\n完成。接下来会启动 Metro（-c 清 bundler 缓存）。\n')
