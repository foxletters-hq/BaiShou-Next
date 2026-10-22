#!/usr/bin/env node
/* eslint-disable @typescript-eslint/explicit-function-return-type -- desktop build script（.mjs） */
/**
 * electron-builder 26+ runs `pnpm list --depth Infinity` to collect node_modules.
 * In this monorepo (desktop + mobile), that command OOMs before packaging finishes.
 * Use manual traversal instead — same result for hoisted pnpm, far lower memory use.
 *
 * 默认 --publish never：正式 Release 由 GitHub Actions（action-gh-release）上传；
 * electron-builder.yml 的 publish 仅用于 electron-updater 检查更新，不在构建时发 Release。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = resolve(desktopRoot, '../..')

const hasPublishArg = process.argv.some(
  (arg, index) =>
    arg === '--publish' ||
    arg.startsWith('--publish=') ||
    (arg === '-p' && process.argv[index + 1] === 'publish')
)
if (!hasPublishArg) {
  process.argv.push('--publish', 'never')
}

const BUILTIN = new Set(['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)])
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

function toPackageName(specifier) {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    return name ? `${scope}/${name}` : scope
  }
  return specifier.split('/')[0]
}

function walkJsFiles(dir, files = []) {
  if (!existsSync(dir)) return files
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkJsFiles(full, files)
    else if (/\.(?:c|m)?js$/.test(entry.name)) files.push(full)
  }
  return files
}

/**
 * 仅收集 out/main 与 out/preload 实际未打包（external）的运行时依赖。
 * 已被 electron-vite 打进 bundle 的工作区包（@baishou/*）与纯渲染层依赖（@fontsource/*、mermaid、antd、react-icons 等）
 * 不再递归拷入 app.asar/node_modules，避免安装包膨胀数百 MB。
 */
function buildRuntimeRootDependencies() {
  const specs = new Set([
    'better-sqlite3',
    'sqlite-vec',
    'dugite',
    'tesseract.js',
    'tesseract.js-core',
    '@libsql/client'
  ])
  const patterns = [
    /\b(?:require|nodeRequire|req)\s*(?:\.\s*resolve\s*)?\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)?['"]([^'"]+)['"]\s*\)/g
  ]
  for (const sub of ['main', 'preload']) {
    for (const file of walkJsFiles(join(desktopRoot, 'out', sub))) {
      const code = readFileSync(file, 'utf8')
      for (const pattern of patterns) {
        for (const match of code.matchAll(pattern)) {
          const spec = match[1]
          if (!spec || spec.startsWith('.') || spec.startsWith('/')) continue
          if (BUILTIN.has(spec) || spec.startsWith('node:')) continue
          const pkg = toPackageName(spec)
          if (BUILTIN.has(pkg) || WORKSPACE_BUNDLED.has(pkg)) continue
          if (!/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(pkg)) continue
          specs.add(pkg)
        }
      }
    }
  }

  const allDeclaredDeps = {}
  const allDeclaredOptional = {}
  const pkgJsonFiles = [
    join(desktopRoot, 'package.json'),
    ...readdirSync(join(repoRoot, 'packages'))
      .map((d) => join(repoRoot, 'packages', d, 'package.json'))
      .filter((p) => existsSync(p))
  ]
  for (const p of pkgJsonFiles) {
    const j = JSON.parse(readFileSync(p, 'utf8'))
    Object.assign(allDeclaredDeps, j.dependencies || {})
    if (p === join(desktopRoot, 'package.json')) {
      Object.assign(allDeclaredOptional, j.optionalDependencies || {})
    }
  }

  const dependencies = {}
  const optionalDependencies = { ...allDeclaredOptional }
  for (const pkg of specs) {
    if (optionalDependencies[pkg]) continue
    if (allDeclaredDeps[pkg]) {
      dependencies[pkg] = allDeclaredDeps[pkg]
    } else {
      optionalDependencies[pkg] = '*'
    }
  }

  return { dependencies, optionalDependencies }
}

const collectorIndex = require('app-builder-lib/out/node-module-collector/index.js')
const { PM } = require('app-builder-lib/out/node-module-collector/packageManager')
const originalGetCollector = collectorIndex.getCollectorByPackageManager

collectorIndex.getCollectorByPackageManager = (pm, rootDir, tempDirManager) => {
  if (pm === PM.PNPM) {
    const collector = originalGetCollector(PM.TRAVERSAL, rootDir, tempDirManager)
    const originalGetDependenciesTree = collector.getDependenciesTree.bind(collector)
    collector.getDependenciesTree = async (targetPm) => {
      const resolvedBaseDir = await collector.cache.realPath[rootDir]
      const pkgPath = join(resolvedBaseDir, 'package.json')
      const origPkg = await collector.cache.json[pkgPath]
      if (origPkg && existsSync(join(desktopRoot, 'out', 'main'))) {
        const { dependencies, optionalDependencies } = buildRuntimeRootDependencies()
        collector.cache.json[pkgPath] = Promise.resolve({
          ...origPkg,
          dependencies,
          optionalDependencies
        })
      }
      return originalGetDependenciesTree(targetPm)
    }
    return collector
  }
  return originalGetCollector(pm, rootDir, tempDirManager)
}

require('electron-builder/out/cli/cli')
