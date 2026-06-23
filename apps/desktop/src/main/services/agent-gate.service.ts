import { BrowserWindow } from 'electron'
import {
  bridgeAgentGateEventBus,
  createBaishouAgentGate,
  type BaishouAgentGateService,
  type BaishouAgentGateAllowlistStore
} from '@baishou/ai'
import {
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  type BaishouAgentGateConfig,
  type AgentGateTrustMode
} from '@baishou/shared'
import { settingsManager } from '../ipc/settings.ipc'

let runtime: ReturnType<typeof createBaishouAgentGate> | null = null
let bridgeRegistered = false
let lifecycleBridgeUnsub: (() => void) | null = null

async function loadGateConfig(): Promise<BaishouAgentGateConfig> {
  const saved = await settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)
  return {
    ...DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
    ...saved,
    exclusionList: saved?.exclusionList?.length
      ? [...saved.exclusionList]
      : [...DEFAULT_BAISHOU_AGENT_GATE_CONFIG.exclusionList],
    allowlist: saved?.allowlist ? [...saved.allowlist] : []
  }
}

async function persistGateConfig(): Promise<void> {
  if (!runtime) return
  await settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, runtime.getConfig())
}

export async function ensureAgentGateRuntime(): Promise<
  ReturnType<typeof createBaishouAgentGate>
> {
  if (!runtime) {
    const config = await loadGateConfig()
    runtime = createBaishouAgentGate({
      config,
      persistConfig: persistGateConfig
    })
    lifecycleBridgeUnsub?.()
    lifecycleBridgeUnsub = bridgeAgentGateEventBus(runtime.eventBus)
  }
  return runtime
}

export async function getAgentGate(): Promise<BaishouAgentGateService> {
  return (await ensureAgentGateRuntime()).gate
}

export async function getAgentGateAllowlistStore(): Promise<BaishouAgentGateAllowlistStore> {
  return (await ensureAgentGateRuntime()).allowlistStore
}

export async function getAgentGateConfig(): Promise<BaishouAgentGateConfig> {
  return (await ensureAgentGateRuntime()).getConfig()
}

export async function setAgentGateTrustMode(
  trustMode: AgentGateTrustMode
): Promise<BaishouAgentGateConfig> {
  const rt = await ensureAgentGateRuntime()
  rt.getConfig().trustMode = trustMode
  await settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, rt.getConfig())
  return rt.getConfig()
}

export async function removeAgentGateAllowlistEntry(id: string): Promise<boolean> {
  const rt = await ensureAgentGateRuntime()
  const removed = rt.allowlistStore.remove(id)
  if (!removed) return false
  await rt.allowlistStore.persist()
  rt.eventBus.publish({
    type: 'agent_gate.allowlist_changed',
    allowlist: rt.allowlistStore.list()
  })
  return true
}

export function cancelAgentGateSession(sessionId: string, reason?: string): void {
  runtime?.gate.cancelSession(sessionId, reason)
}

export function cancelAllAgentGateSessions(reason?: string): void {
  if (!runtime) return
  const sessionIds = new Set(runtime.gate.listPending().map((request) => request.sessionId))
  for (const sessionId of sessionIds) {
    runtime.gate.cancelSession(sessionId, reason)
  }
}

/** 将门控 asked / allowlist 事件广播到所有渲染进程窗口 */
export function registerAgentGateEventBridge(): void {
  if (bridgeRegistered) return
  bridgeRegistered = true

  void ensureAgentGateRuntime().then(({ eventBus }) => {
    eventBus.subscribe((event) => {
      if (event.type === 'agent_gate.asked') {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('agent-gate:asked', event.request)
          }
        }
        return
      }

      if (event.type === 'agent_gate.replied') {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('agent-gate:replied', {
              sessionId: event.sessionId,
              requestId: event.requestId,
              reply: event.reply
            })
          }
        }
        return
      }

      if (event.type === 'agent_gate.allowlist_changed') {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('agent-gate:allowlist-changed', event.allowlist)
          }
        }
      }
    })
  })
}
