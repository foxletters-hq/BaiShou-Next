#!/usr/bin/env node
/**
 * electron-builder 26+ runs `pnpm list --depth Infinity` to collect node_modules.
 * In this monorepo (desktop + mobile), that command OOMs before packaging finishes.
 * Use manual traversal instead — same result for hoisted pnpm, far lower memory use.
 *
 * 默认 --publish never：正式 Release 由 GitHub Actions（action-gh-release）上传；
 * electron-builder.yml 的 publish 仅用于 electron-updater 检查更新，不在构建时发 Release。
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const hasPublishArg = process.argv.some(
  (arg, index) =>
    arg === '--publish' ||
    arg.startsWith('--publish=') ||
    (arg === '-p' && process.argv[index + 1] === 'publish')
)
if (!hasPublishArg) {
  process.argv.push('--publish', 'never')
}

const collectorIndex = require('app-builder-lib/out/node-module-collector/index.js')
const { PM } = require('app-builder-lib/out/node-module-collector/packageManager')
const originalGetCollector = collectorIndex.getCollectorByPackageManager

collectorIndex.getCollectorByPackageManager = (pm, rootDir, tempDirManager) => {
  if (pm === PM.PNPM) {
    return originalGetCollector(PM.TRAVERSAL, rootDir, tempDirManager)
  }
  return originalGetCollector(pm, rootDir, tempDirManager)
}

require('electron-builder/out/cli/cli')
