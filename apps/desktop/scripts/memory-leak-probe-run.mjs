#!/usr/bin/env node
/**
 * 一键：后台启动 desktop:dev → 等待 CDP → 自动跑内存探测
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseProbeArgs,
  runMemoryProbe,
  runMemoryProbeSuite,
  spawnDesktopDev,
  isCdpReady
} from './memory-leak-probe-lib.mjs'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseProbeArgs(process.argv.slice(2))

async function main() {
  const devRunning = await isCdpReady()
  if (!devRunning) {
    spawnDesktopDev(desktopRoot)
  } else {
    console.log('[mem-probe] 检测到 dev 已在运行，直接探测')
  }

  const waitSec = devRunning ? args.waitSec : Number(process.env.BAISHOU_PROBE_WAIT_SEC || 180)

  if (args.scenario === 'all') {
    const suite = await runMemoryProbeSuite({
      rounds: args.rounds,
      waitSec
    })
    if (suite.overallVerdict === 'leak_suspected') {
      process.exit(2)
    }
    return
  }

  const report = await runMemoryProbe({
    scenario: args.scenario,
    rounds: args.rounds,
    waitSec
  })

  if (report.verdict === 'leak_suspected') {
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('[mem-probe] 失败:', err.message || err)
  process.exit(1)
})
