#!/usr/bin/env node
/**
 * 依据 packages/ui 的两个入口文件，生成组件索引清单并写入 packages/ui/COMPONENTS.md 的标记区块。
 *
 * 同时校验三件事：
 *   1. 入口导出的组件必须登记在 manifest 的某个分组里；
 *   2. manifest 登记的组件必须在 packages/ui/src 下真实存在；
 *   3. 同一个组件不能重复登记在两个分组里。
 *
 * 维护分组：scripts/ui-component-index.manifest.json → pnpm sync
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(root, 'scripts/ui-component-index.manifest.json')
const srcRoot = join(root, 'packages/ui/src')
const docPath = join(root, 'packages/ui/COMPONENTS.md')

const checkOnly = process.argv.includes('--check')

const PLATFORMS = [
  { key: 'desktop', label: '桌面端', entry: join(srcRoot, 'index.ts') },
  { key: 'native', label: '移动端', entry: join(srcRoot, 'native/index.ts') }
]

const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/
const IGNORED_DIRS = new Set(['node_modules', 'dist', '__tests__', 'test-utils'])

/**
 * 从导出路径里取出组件名，取最后一个大写开头的路径段：
 *   './desktop/Switch/Switch' 取 Switch
 *   './desktop/ContextUsageRing/index' 取 ContextUsageRing
 *   './desktop/HelpTooltip/SettingsHelpIconButton' 取 SettingsHelpIconButton
 *
 * 取最后一段而不是第一段，是为了让同一个目录下额外导出的组件也必须登记。
 */
function collectExportedComponents(entryFile) {
  const source = readFileSync(entryFile, 'utf8')
  const names = new Set()
  for (const match of source.matchAll(/\bfrom\s+'([^']+)'/g)) {
    const segments = match[1].split('/').filter((segment) => segment !== '.' && segment !== '..')
    const component = segments.filter((segment) => COMPONENT_NAME.test(segment)).at(-1)
    if (component) names.add(component)
  }
  return names
}

function collectSourceNames(dir, into) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      into.add(entry.name)
      collectSourceNames(join(dir, entry.name), into)
      continue
    }
    if (/\.tsx?$/.test(entry.name)) into.add(entry.name.replace(/\.tsx?$/, ''))
  }
  return into
}

function collectProblems(manifest, sourceNames) {
  const problems = []

  for (const { key, label, entry } of PLATFORMS) {
    const groups = manifest[key]
    if (!groups) {
      problems.push(`manifest 缺少 ${key} 段`)
      continue
    }

    const groupOf = new Map()
    for (const [group, names] of Object.entries(groups)) {
      for (const name of names) {
        if (groupOf.has(name)) {
          problems.push(`${label}：${name} 同时登记在「${groupOf.get(name)}」和「${group}」`)
          continue
        }
        groupOf.set(name, group)
      }
    }

    for (const name of collectExportedComponents(entry)) {
      if (!groupOf.has(name)) {
        problems.push(`${label}：${name} 已从入口导出，但没有登记到 manifest 的任何分组`)
      }
    }

    for (const name of groupOf.keys()) {
      if (!sourceNames.has(name)) {
        problems.push(`${label}：${name} 登记在 manifest，但在 packages/ui/src 下找不到`)
      }
    }
  }

  return problems
}

function renderGroups(groups) {
  return Object.entries(groups)
    .map(([group, names]) => `- **${group}**：${names.map((name) => `\`${name}\``).join(' ')}`)
    .join('\n')
}

function replaceBlock(doc, key, body) {
  const start = `<!-- ${key}:start -->`
  const end = `<!-- ${key}:end -->`
  const startAt = doc.indexOf(start)
  const endAt = doc.indexOf(end)

  if (startAt === -1 || endAt === -1 || endAt < startAt) {
    console.error(`[sync-component-index] COMPONENTS.md 缺少 ${key}:start / ${key}:end 标记`)
    process.exit(1)
  }

  return `${doc.slice(0, startAt + start.length)}\n\n${body}\n\n${doc.slice(endAt)}`
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const problems = collectProblems(manifest, collectSourceNames(srcRoot, new Set()))

if (problems.length > 0) {
  console.error('[sync-component-index] 组件与索引分组不一致：')
  for (const problem of problems) console.error(`  - ${problem}`)
  console.error('\n请更新 scripts/ui-component-index.manifest.json 后重试: pnpm sync')
  process.exit(1)
}

const current = readFileSync(docPath, 'utf8').replaceAll('\r\n', '\n')
let next = current
for (const { key } of PLATFORMS) {
  next = replaceBlock(next, key, renderGroups(manifest[key]))
}

if (checkOnly) {
  if (next !== current) {
    console.error('[sync-component-index] COMPONENTS.md 不是最新。Run: pnpm sync')
    process.exit(1)
  }
  console.log('[sync-component-index] OK')
} else if (next === current) {
  console.log('[sync-component-index] Up to date.')
} else {
  writeFileSync(docPath, next, 'utf8')
  console.log('[sync-component-index] Wrote packages/ui/COMPONENTS.md')
}
