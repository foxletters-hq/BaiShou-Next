#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- desktop build script（.mjs） */
/**
 * 打包后校验：扫描 main/preload 中的 runtime require，确认 app.asar 里能解析到对应模块。
 * 在 electron-builder --dir 之后运行，一次性列出所有缺失依赖，避免装完才发现。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { builtinModules, createRequire } from 'node:module'
import { platform } from 'node:os'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(`[verify-desktop-pack] ${message}`)
  process.exit(1)
}

/** @returns {{ packRoot: string, macStyle: boolean }} */
function resolvePackLayout() {
  const distDir = join(desktopRoot, 'dist')
  if (!existsSync(distDir)) {
    fail(`未找到 ${distDir}，请先执行 npm run build:unpack`)
  }

  const unpackedDirs = readdirSync(distDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('-unpacked'))
    .map((entry) => join(distDir, entry.name))

  if (unpackedDirs.length > 0) {
    return { packRoot: unpackedDirs[0], macStyle: false }
  }

  if (platform() === 'darwin') {
    const macResources = readdirSync(distDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith('.app'))
      .map((entry) => join(distDir, entry.name, 'Contents', 'Resources'))
    if (macResources.length > 0) {
      return { packRoot: macResources[0], macStyle: true }
    }
  }

  fail(`未在 ${distDir} 找到 *-unpacked 或 .app 打包目录，请先执行 npm run build:unpack`)
}

const { packRoot, macStyle } = resolvePackLayout()
const resourcesDir = macStyle ? packRoot : join(packRoot, 'resources')
const asarPath = join(resourcesDir, 'app.asar')

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

const BUILTIN = new Set(['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)])

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
  // 仅匹配 app 根 node_modules；勿用 includes，否则 @baishou/ui/node_modules/date-fns 会误报
  const relPath = packageName.startsWith('@')
    ? `node_modules\\${packageName.replace('/', '\\')}\\package.json`
    : `node_modules\\${packageName}\\package.json`
  for (const entry of entries) {
    const normalized = entry.replace(/\//g, '\\').replace(/^\\+/, '')
    if (normalized === relPath) return true
  }
  return false
}

/** @param {string} packageName @returns {boolean} */
function hasPackageInUnpacked(packageName) {
  const base = join(resourcesDir, 'app.asar.unpacked', 'node_modules')
  if (!existsSync(base)) return false
  const pkgDir = join(base, ...packageName.split('/'))
  return existsSync(join(pkgDir, 'package.json'))
}

/** @returns {string} */
function resolveDugiteGitBinary() {
  const dugiteRoot = join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'dugite', 'git')
  if (platform() === 'win32') {
    return join(dugiteRoot, 'cmd', 'git.exe')
  }
  return join(dugiteRoot, 'bin', 'git')
}

if (!existsSync(asarPath)) {
  fail(`未找到 ${asarPath}，请先执行 npm run build:unpack`)
}

const mainBundlePath = join(desktopRoot, 'out', 'main', 'index.js')
const mainBundle = readFileSync(mainBundlePath, 'utf8')
if (/_interopNamespace(?:Default|Compat)\(\s*sqliteVec\s*\)/.test(mainBundle)) {
  fail(
    "sqlite-vec 仍使用 namespace interop 包装，打包后启动会报 Cannot read properties of undefined (reading 'get')。\n" +
      '请确认 packages/database/src/drivers/node-sqlite.driver.ts 使用 require("sqlite-vec") 后重新 build。'
  )
}

const required = [
  ...collectRuntimeRequires(mainBundlePath),
  ...collectRuntimeRequires(join(desktopRoot, 'out', 'preload', 'index.js'))
]
const uniqueRequired = [...new Set(required)].sort()

console.log(
  `[verify-desktop-pack] 扫描到 ${uniqueRequired.length} 个需在 asar 中可解析的运行时依赖`
)

const entries = listAsarEntries()
const missing = []
for (const pkg of uniqueRequired) {
  if (!hasPackageInAsar(entries, pkg) && !hasPackageInUnpacked(pkg)) {
    missing.push(pkg)
  }
}

if (missing.length > 0) {
  console.error(
    '[verify-desktop-pack] 以下依赖未出现在打包产物中（启动时可能 Cannot find module）：'
  )
  for (const pkg of missing) {
    console.error(`  - ${pkg}`)
  }
  console.error(
    '\n建议：将缺失包加入 apps/desktop/package.json dependencies，或调整 electron.vite 的 bundle/external 策略后重新 build:unpack。'
  )
  process.exit(1)
}

console.log('[verify-desktop-pack] 全部运行时依赖已在 app.asar / app.asar.unpacked 中就位')

const dugiteGitBinary = resolveDugiteGitBinary()

if (!existsSync(dugiteGitBinary)) {
  fail(
    `未找到内置 Git 可执行文件：${dugiteGitBinary}\n` +
      '请确认 electron-builder.yml 已配置 asarUnpack: node_modules/dugite/**，且 pnpm install 已下载 dugite 内置 Git。'
  )
}

console.log(`[verify-desktop-pack] 内置 Git 已就位: ${dugiteGitBinary}`)
