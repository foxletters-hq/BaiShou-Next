#!/usr/bin/env node
/**
 * 打包后校验：扫描 main/preload 中的 runtime require，确认 app.asar 里能解析到对应模块。
 * 在 electron-builder --dir 之后运行，一次性列出所有缺失依赖，避免装完才发现。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { builtinModules, createRequire } from 'node:module'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const unpackedRoot = join(desktopRoot, 'dist', 'win-unpacked')
const asarPath = join(unpackedRoot, 'resources', 'app.asar')

const WORKSPACE_BUNDLED = new Set([
  '@baishou/ai',
  '@baishou/core',
  '@baishou/core-desktop',
  '@baishou/core/shared',
  '@baishou/database',
  '@baishou/database-desktop',
  '@baishou/shared',
  '@baishou/store',
  '@baishou/ui'
])

const BUILTIN = new Set([
  'electron',
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`)
])

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`[verify-desktop-pack] ${message}`)
  process.exit(1)
}

/** @param {string} specifier @returns {string} */
function toPackageName(specifier) {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    if (!name) return scope
    return `${scope}/${name}`
  }
  return specifier.split('/')[0]
}

/** @param {string} filePath @returns {string[]} */
function collectRuntimeRequires(filePath) {
  if (!existsSync(filePath)) return []
  const code = readFileSync(filePath, 'utf8')
  const specs = new Set()
  // 仅扫描 require / dynamic import；勿匹配 `from`（bundle 内 drizzle 等会产生大量误报）
  const patterns = [
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  ]
  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      const spec = match[1]
      if (!spec || spec.startsWith('.') || spec.startsWith('/')) continue
      if (BUILTIN.has(spec) || spec.startsWith('node:')) continue
      const pkg = toPackageName(spec)
      if (BUILTIN.has(pkg)) continue
      if (!/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(pkg)) continue
      if (WORKSPACE_BUNDLED.has(pkg)) continue
      specs.add(pkg)
    }
  }
  return [...specs].sort()
}

/** @returns {Set<string>} */
function listAsarEntries() {
  const repoRoot = join(desktopRoot, '..', '..')
  const requireFromRoot = createRequire(pathToFileURL(join(repoRoot, 'package.json')))
  let listPackage
  try {
    ;({ listPackage } = requireFromRoot('@electron/asar'))
  } catch {
    fail('未找到 @electron/asar，请在仓库根目录执行 pnpm install')
  }
  try {
    return new Set(listPackage(asarPath))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    fail(`无法读取 ${asarPath}：${message}`)
  }
}

/** @param {Set<string>} entries @param {string} packageName @returns {boolean} */
function hasPackageInAsar(entries, packageName) {
  const prefix =
    packageName.startsWith('@')
      ? `\\node_modules\\${packageName.replace('/', '\\')}\\`
      : `\\node_modules\\${packageName}\\`
  for (const entry of entries) {
    if (entry.includes(`${prefix}package.json`)) return true
  }
  return false
}

/** @param {string} packageName @returns {boolean} */
function hasPackageInUnpacked(packageName) {
  const base = join(unpackedRoot, 'resources', 'app.asar.unpacked', 'node_modules')
  const pkgDir = join(base, ...packageName.split('/'))
  return existsSync(join(pkgDir, 'package.json'))
}

if (!existsSync(asarPath)) {
  fail(`未找到 ${asarPath}，请先执行 npm run build:unpack`)
}

const mainBundlePath = join(desktopRoot, 'out', 'main', 'index.js')
const mainBundle = readFileSync(mainBundlePath, 'utf8')
if (/_interopNamespace(?:Default|Compat)\(\s*sqliteVec\s*\)/.test(mainBundle)) {
  fail(
    'sqlite-vec 仍使用 namespace interop 包装，打包后启动会报 Cannot read properties of undefined (reading \'get\')。\n' +
      '请确认 packages/database/src/drivers/node-sqlite.driver.ts 使用 require("sqlite-vec") 后重新 build。'
  )
}

const required = [
  ...collectRuntimeRequires(mainBundlePath),
  ...collectRuntimeRequires(join(desktopRoot, 'out', 'preload', 'index.js'))
]
const uniqueRequired = [...new Set(required)].sort()

console.log(`[verify-desktop-pack] 扫描到 ${uniqueRequired.length} 个需在 asar 中可解析的运行时依赖`)

const entries = listAsarEntries()
const missing = []
for (const pkg of uniqueRequired) {
  if (!hasPackageInAsar(entries, pkg) && !hasPackageInUnpacked(pkg)) {
    missing.push(pkg)
  }
}

if (missing.length > 0) {
  console.error('[verify-desktop-pack] 以下依赖未出现在打包产物中（启动时可能 Cannot find module）：')
  for (const pkg of missing) {
    console.error(`  - ${pkg}`)
  }
  console.error(
    '\n建议：将缺失包加入 apps/desktop/package.json dependencies，或调整 electron.vite 的 bundle/external 策略后重新 build:unpack。'
  )
  process.exit(1)
}

console.log('[verify-desktop-pack] 全部运行时依赖已在 app.asar / app.asar.unpacked 中就位')
