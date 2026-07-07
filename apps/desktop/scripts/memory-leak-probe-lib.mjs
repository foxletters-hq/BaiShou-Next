/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { spawn } from 'node:child_process'

const CDP_PORT = process.env.BAISHOU_CDP_PORT || '9333'

export function parseProbeArgs(argv) {
  let waitSec = 90
  let spawnDev = false
  const positional = []

  for (const arg of argv) {
    if (arg === '--no-wait') waitSec = 0
    else if (arg === '--with-dev') spawnDev = true
    else if (arg.startsWith('--wait=')) waitSec = Number(arg.slice(7))
    else if (!arg.startsWith('--')) positional.push(arg)
  }

  const scenario = positional[0] || 'settings-toggle'
  const defaultRounds = scenario === 'all' ? 5 : 8
  const rounds = Number(positional[1] ?? defaultRounds)

  return {
    waitSec: Number.isFinite(waitSec) ? Math.max(0, waitSec) : 90,
    spawnDev,
    scenario,
    rounds: Number.isFinite(rounds) ? rounds : defaultRounds
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function tryListTargets() {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`, {
      signal: AbortSignal.timeout(2000)
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function isCdpReady() {
  const targets = await tryListTargets()
  return Boolean(targets?.length)
}

export async function waitForCdp(waitSec) {
  if (waitSec <= 0) {
    const targets = await tryListTargets()
    if (!targets?.length) {
      throw new Error(`CDP :${CDP_PORT} 未就绪。请先 pnpm --filter desktop dev`)
    }
    return targets
  }

  const deadline = Date.now() + waitSec * 1000
  console.log(`[mem-probe] 等待 CDP :${CDP_PORT}（最多 ${waitSec}s）…`)

  while (Date.now() < deadline) {
    const targets = await tryListTargets()
    if (targets?.length) {
      console.log('[mem-probe] CDP 已连接')
      return targets
    }
    await sleep(1500)
  }

  throw new Error(
    `等待 ${waitSec}s 仍无法连接 CDP :${CDP_PORT}。请先运行: pnpm --filter desktop dev`
  )
}

function pickRendererTarget(targets) {
  return (
    targets.find(
      (t) =>
        t.type === 'page' &&
        (t.url.includes('localhost') || t.url.includes('127.0.0.1') || t.url.includes('index.html'))
    ) ?? targets.find((t) => t.type === 'page')
  )
}

function formatCdpException(details) {
  if (!details) return '未知 CDP 异常'
  const parts = [details.exception?.description, details.text, details.exception?.value].filter(
    Boolean
  )
  if (parts.length > 0) return parts.join(' | ')
  try {
    return JSON.stringify(details)
  } catch {
    return String(details)
  }
}

function cdpEvaluate(webSocketDebuggerUrl, expression, timeoutMs = 5 * 60 * 1000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketDebuggerUrl)
    const requestId = 1
    const timeout = setTimeout(() => {
      ws.close()
      reject(new Error('CDP 执行超时'))
    }, timeoutMs)

    ws.addEventListener('open', () => {
      ws.send(
        JSON.stringify({
          id: requestId,
          method: 'Runtime.evaluate',
          params: {
            expression,
            awaitPromise: true,
            returnByValue: true
          }
        })
      )
    })

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data))
      if (msg.id !== requestId) return
      clearTimeout(timeout)
      ws.close()

      if (msg.result?.exceptionDetails) {
        reject(new Error(formatCdpException(msg.result.exceptionDetails)))
        return
      }

      resolve(msg.result?.result?.value)
    })

    ws.addEventListener('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

async function pickProbeTarget(targets) {
  const pages = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl)
  const sorted = [
    ...pages.filter((t) => /localhost|127\.0\.0\.1/.test(t.url || '')),
    ...pages.filter((t) => !/localhost|127\.0\.0\.1/.test(t.url || ''))
  ]

  for (const target of sorted) {
    try {
      const state = await cdpEvaluate(
        target.webSocketDebuggerUrl,
        `({
          hasProbe: Boolean(window.__baiShouMemProbe),
          version: window.__baiShouMemProbe?.version ?? 0,
          hash: location.hash || '',
          href: location.href || ''
        })`
      )
      if (state?.hasProbe) {
        return { target, state }
      }
    } catch {
      // try next target
    }
  }

  const fallback = pickRendererTarget(targets)
  if (!fallback?.webSocketDebuggerUrl) return null
  return { target: fallback, state: null }
}

async function waitForProbeTarget(_initialTargets, waitSec) {
  const deadline = Date.now() + waitSec * 1000
  while (Date.now() < deadline) {
    const targets = (await tryListTargets()) || []
    const picked = await pickProbeTarget(targets)
    if (picked?.state?.hasProbe) {
      return picked
    }
    await sleep(1000)
  }
  throw new Error(
    '未找到带 __baiShouMemProbe 的页面。请先完成 welcome 引导进入主界面，并确认已用最新代码重启 desktop:dev'
  )
}

const REQUIRED_PROBE_VERSION = 2

function assertProbeVersion(state) {
  const version = state?.version ?? 0
  if (version >= REQUIRED_PROBE_VERSION) return
  throw new Error(
    `内存探测脚本版本过旧（当前 v${version || '无'}，需要 v${REQUIRED_PROBE_VERSION}）。请完全退出并重启 desktop:dev 后再跑 mem:probe`
  )
}

const VERDICT_LABELS = {
  stable: '✅ 稳定（未见明显阶梯上涨）',
  warm_cache: '⚠️ 预热后平台（首轮加载，未必是泄漏）',
  leak_suspected: '❌ 疑似泄漏（建议做 Heap Comparison 查 Detached）',
  inconclusive: '❓ inconclusive（增加轮次或手动 Snapshot）'
}

export async function runMemoryProbe({ scenario, rounds, waitSec = 90 }) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('需要 Node 22+（内置 WebSocket）')
  }

  console.log(`[mem-probe] 场景=${scenario}，轮次=${rounds}`)

  const targets = await waitForCdp(waitSec)
  console.log('[mem-probe] 查找已注入探测 API 的页面…')
  const picked = await waitForProbeTarget(targets, Math.min(waitSec, 60))
  const { target, state } = picked

  if (String(state?.hash || '').includes('/welcome')) {
    throw new Error('应用仍在 /welcome 引导页，请先完成 onboarding 进入主界面后再测')
  }

  console.log(
    `[mem-probe] 目标: ${target.title || target.url} (${state?.hash || 'no hash'}, probe v${state?.version ?? '?'})`
  )
  assertProbeVersion(state)

  const expression = `(async () => {
    try {
      if (!window.__baiShouMemProbe) {
        return { __probeError: '__baiShouMemProbe 未安装', hash: location.hash };
      }
      if ((window.__baiShouMemProbe.version ?? 0) < ${REQUIRED_PROBE_VERSION}) {
        return {
          __probeError: '探测脚本版本过旧（v' + (window.__baiShouMemProbe.version ?? 0) + '），请完全重启 desktop:dev',
          hash: location.hash
        };
      }
      if (String(location.hash || '').includes('/welcome')) {
        return { __probeError: '仍在 welcome 引导页', hash: location.hash };
      }
      return await window.__baiShouMemProbe.run(${JSON.stringify(scenario)}, { rounds: ${rounds} });
    } catch (e) {
      return {
        __probeError: e && (e.message || String(e)),
        stack: e && e.stack,
        hash: location.hash
      };
    }
  })()`

  const report = await cdpEvaluate(target.webSocketDebuggerUrl, expression)

  if (report?.__probeError) {
    throw new Error(
      `${report.__probeError}${report.hash ? ` (hash=${report.hash})` : ''}${report.stack ? `\n${report.stack}` : ''}`
    )
  }

  console.log('\n========== 探测报告 ==========')
  console.log(JSON.stringify(report, null, 2))
  console.log('==============================\n')
  console.log(VERDICT_LABELS[report.verdict] || report.verdict)
  console.log(report.summary)

  return report
}

export async function runMemoryProbeSuite({ rounds, waitSec = 90 }) {
  if (typeof WebSocket === 'undefined') {
    throw new Error('需要 Node 22+（内置 WebSocket）')
  }

  const suiteRounds = rounds ?? 5
  console.log(`[mem-probe] 全量探测，每场景 ${suiteRounds} 轮`)

  const targets = await waitForCdp(waitSec)
  console.log('[mem-probe] 查找已注入探测 API 的页面…')
  const picked = await waitForProbeTarget(targets, Math.min(waitSec, 60))
  const { target, state } = picked

  if (String(state?.hash || '').includes('/welcome')) {
    throw new Error('应用仍在 /welcome 引导页，请先完成 onboarding 进入主界面后再测')
  }

  console.log(
    `[mem-probe] 目标: ${target.title || target.url} (${state?.hash || 'no hash'}, probe v${state?.version ?? '?'})`
  )
  assertProbeVersion(state)

  const expression = `(async () => {
    try {
      if (!window.__baiShouMemProbe?.runAll) {
        return { __probeError: '__baiShouMemProbe.runAll 未安装，请重启 desktop:dev' };
      }
      if ((window.__baiShouMemProbe.version ?? 0) < ${REQUIRED_PROBE_VERSION}) {
        return {
          __probeError: '探测脚本版本过旧（v' + (window.__baiShouMemProbe.version ?? 0) + '），请完全重启 desktop:dev',
          hash: location.hash
        };
      }
      return await window.__baiShouMemProbe.runAll({ rounds: ${suiteRounds} });
    } catch (e) {
      return {
        __probeError: e && (e.message || String(e)),
        stack: e && e.stack,
        hash: location.hash
      };
    }
  })()`

  const suite = await cdpEvaluate(target.webSocketDebuggerUrl, expression, 25 * 60 * 1000)

  if (suite?.__probeError) {
    throw new Error(
      `${suite.__probeError}${suite.hash ? ` (hash=${suite.hash})` : ''}${suite.stack ? `\n${suite.stack}` : ''}`
    )
  }

  console.log('\n========== 全量探测报告 ==========')
  console.log(JSON.stringify(suite, null, 2))
  console.log('==================================\n')
  console.log(
    suite.overallVerdict === 'stable'
      ? '✅ 全量稳定'
      : suite.overallVerdict === 'leak_suspected'
        ? `❌ 疑似泄漏：${(suite.failedScenarios || []).join(', ')}`
        : `⚠️ ${suite.summary}`
  )

  if (suite.reports?.length) {
    console.table(
      suite.reports.map((r) => ({
        scenario: r.scenario,
        verdict: r.verdict,
        heapDeltaMB: r.metrics?.heapGrowthMB,
        domDelta: r.metrics?.domGrowth
      }))
    )
  }

  return suite
}

export function spawnDesktopDev(desktopRoot) {
  const child = spawn('pnpm run dev', {
    cwd: desktopRoot,
    detached: true,
    stdio: 'ignore',
    shell: true,
    windowsHide: false,
    env: process.env
  })

  child.on('error', (err) => {
    console.error('[mem-probe] 启动 dev 失败:', err.message)
  })

  child.unref()
  console.log('[mem-probe] 已在后台启动 desktop:dev，等待应用窗口…')
}
