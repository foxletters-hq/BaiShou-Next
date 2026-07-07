#!/usr/bin/env node
/**
 * 测试文件中 i18n.t(key, default) / t(key, default) 还原为 default 字面量。
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

/** @param {string} dir @returns {string[]} */
function collectTestFiles(dir) {
  /** @type {string[]} */
  const files = []
  if (!fs.existsSync(dir)) return files
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.turbo') continue
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) files.push(...collectTestFiles(full))
    else if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(ent.name)) files.push(full)
  }
  return files
}

const UNWRAP_RE =
  /(?:i18n\.t|(?<![\w.])t)\(\s*['"`]auto\.[^'"`]+['"`]\s*,\s*(`(?:\\.|[^`])*`|'(?:\\.|[^'])*'|"(?:\\.|[^"])*")\s*\)/g

/** @param {string} file */
function revertFile(file) {
  const text = fs.readFileSync(file, 'utf8')
  const next = text.replace(UNWRAP_RE, '$1')
  if (next === text) return false
  let cleaned = next
  if (!/\bi18n\.t\s*\(/.test(cleaned) && !/\bt\s*\(\s*['"`]/.test(cleaned)) {
    cleaned = cleaned.replace(/^import i18n from 'i18next'\n/m, '')
  }
  fs.writeFileSync(file, cleaned, 'utf8')
  return true
}

const roots = [
  path.join(ROOT, 'apps'),
  path.join(ROOT, 'packages')
]

let count = 0
for (const root of roots) {
  for (const file of collectTestFiles(root)) {
    if (revertFile(file)) {
      count += 1
      console.log(path.relative(ROOT, file))
    }
  }
}

console.log(`Reverted i18n wrappers in ${count} test files`)
