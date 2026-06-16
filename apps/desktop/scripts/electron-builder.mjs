#!/usr/bin/env node
/**
 * electron-builder 26+ runs `pnpm list --depth Infinity` to collect node_modules.
 * In this monorepo (desktop + mobile), that command OOMs before packaging finishes.
 * Use manual traversal instead — same result for hoisted pnpm, far lower memory use.
 */
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

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
