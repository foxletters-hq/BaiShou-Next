export type MemSample = {
  round: number
  heapUsedMB: number
  heapTotalMB: number
  domNodes: number
  hash: string
}

export type ProbeVerdict = 'stable' | 'warm_cache' | 'leak_suspected' | 'inconclusive'

export type ProbeReport = {
  scenario: string
  rounds: number
  gcAvailable: boolean
  samples: MemSample[]
  verdict: ProbeVerdict
  summary: string
  metrics: {
    heapGrowthMB: number
    avgGrowthPerRoundMB: number
    monotonicIncreases: number
    domGrowth: number
  }
}

export type ProbeScenarioId =
  | 'settings-toggle'
  | 'settings-idle'
  | 'settings-heavy-tabs'
  | 'chat-toggle'
  | 'hub-settings-toggle'
  | 'hub-settings-idle'
  | 'summary-toggle'
  | 'git-toggle'

export type ProbeSuiteReport = {
  roundsPerScenario: number
  reports: ProbeReport[]
  overallVerdict: ProbeVerdict
  summary: string
  failedScenarios: string[]
}

/** 一键全量探测顺序（由轻到重） */
export const ALL_PROBE_SCENARIOS: ProbeScenarioId[] = [
  'settings-toggle',
  'settings-idle',
  'settings-heavy-tabs',
  'chat-toggle',
  'hub-settings-toggle',
  'hub-settings-idle',
  'summary-toggle',
  'git-toggle'
]

/** 递增后需完全重启 desktop:dev，动态 import 不会热更新探测脚本 */
export const MEMORY_PROBE_VERSION = 2

const SETTINGS_TAB_SEGMENTS = [
  'general',
  'mcp',
  'ai-services',
  'ai-models',
  'rag',
  'web-search',
  'agent-tools',
  'summary'
] as const

/** 停留场景：先预热一轮再采样，避免「未打开页面」的基线干扰 */
const IDLE_SCENARIOS = new Set<ProbeScenarioId>(['settings-idle', 'hub-settings-idle'])

const DOM_PLATEAU_JUMP = 50

async function assertNotOnWelcome(): Promise<void> {
  const hash = window.location.hash || ''
  if (hash.includes('/welcome')) {
    throw new Error(
      '当前在欢迎/引导页（/welcome），请先完成 onboarding 进入主界面后再运行内存探测'
    )
  }
}

function idleRouteMarker(scenario: ProbeScenarioId): '/settings/' | '/hub/' {
  return scenario === 'settings-idle' ? '/settings/' : '/hub/'
}

function idleRoutePrefix(scenario: ProbeScenarioId): '#/settings' | '#/hub' {
  return scenario === 'settings-idle' ? '#/settings' : '#/hub'
}

/** 停留场景：在设置页完成一轮 Tab 预热后再采 baseline */
async function ensureIdleMeasurementBaseline(scenario: ProbeScenarioId): Promise<void> {
  const prefix = idleRoutePrefix(scenario)
  const marker = idleRouteMarker(scenario)

  await navigate('#/diary')
  await sleep(600)
  await navigate(`${prefix}/general`)
  await sleep(1000)
  await cycleSettingsTabs(prefix, 2200)

  if (!window.location.hash.includes(marker)) {
    throw new Error(`停留场景预热失败：期望路由含 ${marker}，当前 ${window.location.hash}`)
  }
}

async function cycleSettingsTabs(prefix: '#/settings' | '#/hub', dwellMs: number): Promise<void> {
  for (const tab of SETTINGS_TAB_SEGMENTS) {
    await navigate(`${prefix}/${tab}`)
    await sleep(dwellMs)
  }
}

const SCENARIOS: Record<ProbeScenarioId, () => Promise<void>> = {
  'settings-toggle': async () => {
    await navigate('#/diary')
    await sleep(800)
    await navigate('#/settings/general')
    await sleep(1200)
    await navigate('#/diary')
    await sleep(800)
  },
  'settings-idle': async () => {
    if (!window.location.hash.includes('/settings')) {
      await navigate('#/settings/general')
      await sleep(1000)
    }
    await cycleSettingsTabs('#/settings', 2200)
  },
  'settings-heavy-tabs': async () => {
    await navigate('#/diary')
    await sleep(500)
    await navigate('#/settings/general')
    await sleep(800)
    await cycleSettingsTabs('#/settings', 700)
    await navigate('#/diary')
    await sleep(800)
  },
  'chat-toggle': async () => {
    await navigate('#/diary')
    await sleep(800)
    await navigate('#/chat')
    await sleep(1200)
    await navigate('#/diary')
    await sleep(800)
  },
  'hub-settings-toggle': async () => {
    await navigate('#/diary')
    await sleep(800)
    await navigate('#/hub/general')
    await sleep(1200)
    await navigate('#/diary')
    await sleep(800)
  },
  'hub-settings-idle': async () => {
    if (!window.location.hash.includes('/hub')) {
      await navigate('#/hub/general')
      await sleep(1000)
    }
    await cycleSettingsTabs('#/hub', 2200)
  },
  'summary-toggle': async () => {
    await navigate('#/diary')
    await sleep(800)
    await navigate('#/summary')
    await sleep(1500)
    await navigate('#/diary')
    await sleep(800)
  },
  'git-toggle': async () => {
    await navigate('#/diary')
    await sleep(800)
    await navigate('#/git')
    await sleep(1500)
    await navigate('#/diary')
    await sleep(800)
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function navigate(hash: string): Promise<void> {
  const target = hash.startsWith('#') ? hash : `#${hash}`
  if (window.location.hash === target) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('hashchange', onHashChange)
      resolve()
    }, 8000)

    const onHashChange = () => {
      if (window.location.hash === target) {
        window.clearTimeout(timeout)
        window.removeEventListener('hashchange', onHashChange)
        resolve()
      }
    }

    window.addEventListener('hashchange', onHashChange)
    window.location.hash = target
  })
}

async function collectGarbage(): Promise<boolean> {
  const gc = (window as Window & { gc?: () => void }).gc
  if (typeof gc !== 'function') {
    await sleep(2000)
    return false
  }
  gc()
  await sleep(400)
  gc()
  await sleep(1200)
  return true
}

function takeSample(round: number): MemSample {
  const mem = (
    performance as Performance & {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number }
    }
  ).memory
  return {
    round,
    heapUsedMB: mem
      ? Math.round((mem.usedJSHeapSize / 1048576) * 10) / 10
      : -1,
    heapTotalMB: mem
      ? Math.round((mem.totalJSHeapSize / 1048576) * 10) / 10
      : -1,
    domNodes: document.getElementsByTagName('*').length,
    hash: window.location.hash
  }
}

function findSteadySampleStart(samples: MemSample[]): number {
  if (samples.length < 2) return 0

  let steadyStart = 0
  for (let i = 1; i < samples.length; i++) {
    const domDelta = Math.abs(samples[i]!.domNodes - samples[i - 1]!.domNodes)
    if (domDelta > DOM_PLATEAU_JUMP) {
      steadyStart = i
    }
  }
  return steadyStart
}

function countMonotonicHeapIncreases(samples: MemSample[]): number {
  let monotonicIncreases = 0
  for (let i = 1; i < samples.length; i++) {
    if (samples[i]!.heapUsedMB > samples[i - 1]!.heapUsedMB + 0.8) {
      monotonicIncreases += 1
    }
  }
  return monotonicIncreases
}

function analyze(samples: MemSample[]): Pick<ProbeReport, 'verdict' | 'summary' | 'metrics'> {
  if (samples.length < 2) {
    return {
      verdict: 'inconclusive',
      summary: '样本不足，无法判断',
      metrics: {
        heapGrowthMB: 0,
        avgGrowthPerRoundMB: 0,
        monotonicIncreases: 0,
        domGrowth: 0
      }
    }
  }

  const steadyStart = findSteadySampleStart(samples)
  const steadySamples = samples.slice(steadyStart)
  const first = steadySamples[0]!
  const last = steadySamples[steadySamples.length - 1]!
  const heapGrowthMB = Math.round((last.heapUsedMB - first.heapUsedMB) * 10) / 10
  const domGrowth = last.domNodes - first.domNodes
  const avgGrowthPerRoundMB =
    steadySamples.length > 1
      ? Math.round((heapGrowthMB / (steadySamples.length - 1)) * 10) / 10
      : 0

  const monotonicIncreases = countMonotonicHeapIncreases(steadySamples)

  const metrics = {
    heapGrowthMB,
    avgGrowthPerRoundMB,
    monotonicIncreases,
    domGrowth
  }

  const steadyStateNote =
    steadyStart > 0 ? `（平台期自第 ${steadyStart} 轮，忽略首次挂载 DOM 跳变）` : ''

  if (samples[0]!.heapUsedMB < 0) {
    return {
      verdict: 'inconclusive',
      summary: '当前环境无 performance.memory（需 Chromium/Electron）',
      metrics
    }
  }

  if (heapGrowthMB <= 4 && domGrowth <= 80) {
    return {
      verdict: 'stable',
      summary: `稳定：${steadySamples.length} 个平台期样本，堆 +${heapGrowthMB} MB，DOM ${domGrowth >= 0 ? '+' : ''}${domGrowth}${steadyStateNote}`,
      metrics
    }
  }

  if (
    heapGrowthMB > 4 &&
    monotonicIncreases < Math.max(2, Math.floor(steadySamples.length * 0.35)) &&
    heapGrowthMB < 20
  ) {
    return {
      verdict: 'warm_cache',
      summary: `首轮预热后平台：堆共 +${heapGrowthMB} MB，单调上升 ${monotonicIncreases} 次${steadyStateNote}`,
      metrics
    }
  }

  if (
    avgGrowthPerRoundMB >= 1.5 ||
    (heapGrowthMB >= 12 && monotonicIncreases >= 3) ||
    (domGrowth >= 250 && monotonicIncreases >= 2)
  ) {
    return {
      verdict: 'leak_suspected',
      summary: `疑似泄漏：堆 +${heapGrowthMB} MB（均 +${avgGrowthPerRoundMB}/轮），DOM +${domGrowth}，单调上升 ${monotonicIncreases} 次${steadyStateNote}`,
      metrics
    }
  }

  return {
    verdict: 'inconclusive',
    summary: `未达判定阈值：堆 +${heapGrowthMB} MB，DOM +${domGrowth}，建议增加轮次或开 Heap Comparison${steadyStateNote}`,
    metrics
  }
}

async function ensureProbeEnvironment(): Promise<void> {
  await assertNotOnWelcome()
  await navigate('#/diary')
  await sleep(1500)
}

export async function runMemoryLeakProbe(options?: {
  scenario?: ProbeScenarioId
  rounds?: number
}): Promise<ProbeReport> {
  const scenario = options?.scenario ?? 'settings-toggle'
  const rounds = Math.max(3, Math.min(options?.rounds ?? 8, 30))
  const action = SCENARIOS[scenario]
  if (!action) {
    throw new Error(`未知场景: ${scenario}`)
  }

  if (IDLE_SCENARIOS.has(scenario)) {
    await assertNotOnWelcome()
    await ensureIdleMeasurementBaseline(scenario)
  } else {
    await ensureProbeEnvironment()
  }

  const samples: MemSample[] = []
  const gcAvailable = await collectGarbage()
  samples.push(takeSample(0))

  if (IDLE_SCENARIOS.has(scenario) && !window.location.hash.includes(idleRouteMarker(scenario))) {
    throw new Error(
      `停留场景 baseline 异常：第 0 轮应在设置页（${idleRouteMarker(scenario)}），当前 ${window.location.hash}`
    )
  }

  for (let round = 1; round <= rounds; round += 1) {
    await action()
    const gcUsed = await collectGarbage()
    samples.push(takeSample(round))
    if (round % 2 === 0 || round === rounds) {
      const s = samples[samples.length - 1]!
      console.info(
        `[mem-probe] ${scenario} round ${round}/${rounds}: heap=${s.heapUsedMB}MB dom=${s.domNodes} gc=${gcUsed}`
      )
    }
  }

  const analysis = analyze(samples)
  const report: ProbeReport = {
    scenario,
    rounds,
    gcAvailable,
    samples,
    ...analysis
  }

  console.table(samples)
  console.info(`[mem-probe] 结论: ${report.verdict} — ${report.summary}`)
  if (!gcAvailable) {
    console.warn(
      '[mem-probe] 未检测到 window.gc；dev 下已启用 --expose-gc，若仍无效请重启 desktop:dev'
    )
  }

  return report
}

function summarizeSuite(reports: ProbeReport[], roundsPerScenario: number): ProbeSuiteReport {
  const failedScenarios = reports
    .filter((r) => r.verdict === 'leak_suspected')
    .map((r) => r.scenario)
  const warmScenarios = reports
    .filter((r) => r.verdict === 'warm_cache')
    .map((r) => r.scenario)

  let overallVerdict: ProbeVerdict = 'stable'
  if (failedScenarios.length > 0) overallVerdict = 'leak_suspected'
  else if (warmScenarios.length > 0) overallVerdict = 'warm_cache'

  const inconclusiveScenarios = reports
    .filter((r) => r.verdict === 'inconclusive')
    .map((r) => r.scenario)

  const summary =
    overallVerdict === 'stable'
      ? inconclusiveScenarios.length > 0
        ? `无泄漏；${inconclusiveScenarios.length} 个场景未达阈值（${inconclusiveScenarios.join(', ')}），可加长轮次复测`
        : `全部 ${reports.length} 个场景稳定（各 ${roundsPerScenario} 轮）`
      : overallVerdict === 'leak_suspected'
        ? `疑似泄漏场景：${failedScenarios.join(', ')}`
        : `预热/缓存场景：${warmScenarios.join(', ')}`

  return {
    roundsPerScenario,
    reports,
    overallVerdict,
    summary,
    failedScenarios
  }
}

export async function runMemoryLeakProbeAll(options?: {
  rounds?: number
  scenarios?: ProbeScenarioId[]
}): Promise<ProbeSuiteReport> {
  const rounds = Math.max(3, Math.min(options?.rounds ?? 5, 20))
  const scenarios = options?.scenarios ?? ALL_PROBE_SCENARIOS
  const reports: ProbeReport[] = []

  console.info(`[mem-probe] 开始全量探测：${scenarios.length} 个场景，每个 ${rounds} 轮`)

  for (const scenario of scenarios) {
    console.info(`[mem-probe] >>> 场景: ${scenario}`)
    const report = await runMemoryLeakProbe({ scenario, rounds })
    reports.push(report)
    await navigate('#/diary')
    await sleep(800)
    await collectGarbage()
  }

  const suite = summarizeSuite(reports, rounds)
  console.info(`[mem-probe] 全量结论: ${suite.overallVerdict} — ${suite.summary}`)
  console.table(
    reports.map((r) => ({
      scenario: r.scenario,
      verdict: r.verdict,
      heapDeltaMB: r.metrics.heapGrowthMB,
      domDelta: r.metrics.domGrowth
    }))
  )

  return suite
}

export function installMemoryLeakProbe(): void {
  const api = {
    version: MEMORY_PROBE_VERSION,
    run: runMemoryLeakProbe,
    runAll: runMemoryLeakProbeAll,
    scenarios: [...ALL_PROBE_SCENARIOS]
  }

  ;(window as Window & { __baiShouMemProbe?: typeof api }).__baiShouMemProbe = api

  console.info(
    `[mem-probe] v${MEMORY_PROBE_VERSION} 已就绪（修改探测脚本后需完全重启 desktop:dev）`
  )
  console.info(
    '[mem-probe] 单场景：await __baiShouMemProbe.run("settings-idle", { rounds: 6 })'
  )
  console.info('[mem-probe] 全量：await __baiShouMemProbe.runAll({ rounds: 5 })')
}
