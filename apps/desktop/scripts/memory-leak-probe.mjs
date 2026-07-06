#!/usr/bin/env node
/**
 * 内存泄漏自动探测
 *
 * 单场景：
 *   pnpm --filter desktop mem:probe
 *   pnpm --filter desktop mem:probe -- settings-idle 6
 *
 * 全量（所有主页面 + 设置停留）：
 *   pnpm --filter desktop mem:probe:all
 *   pnpm --filter desktop mem:probe:all -- 5
 */

import { parseProbeArgs, runMemoryProbe, runMemoryProbeSuite } from './memory-leak-probe-lib.mjs'

const args = parseProbeArgs(process.argv.slice(2))

async function main() {
  if (args.scenario === 'all') {
    const suite = await runMemoryProbeSuite({
      rounds: args.rounds,
      waitSec: args.waitSec
    })
    if (suite.overallVerdict === 'leak_suspected') {
      process.exit(2)
    }
    return
  }

  const report = await runMemoryProbe({
    scenario: args.scenario,
    rounds: args.rounds,
    waitSec: args.waitSec
  })

  if (report.verdict === 'leak_suspected') {
    process.exit(2)
  }
}

main().catch((err) => {
  console.error('[mem-probe] 失败:', err.message || err)
  console.error('\n控制台全量：await __baiShouMemProbe.runAll({ rounds: 5 })')
  process.exit(1)
})
