import { BrowserWindow } from 'electron'
import {
  bridgeAgentGateEventBus,
  createBaishouAgentGate,
  type BaishouAgentGateService,
  type BaishouAgentGateAllowlistStore,
  BaishouAgentGateEventBus
} from '@baishou/ai'
import {
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  cloneBaishouAgentGateConfig,
  type BaishouAgentGateConfig,
  type AgentGateTrustMode,
  type AgentGateConfigScope,
  type AgentGateAllowlistEntry,
  type AgentGateReplyInput
} from '@baishou/shared'
import { settingsManager } from '../ipc/settings.ipc'
import { getWorkspaceGateConfig, setWorkspaceGateConfig } from './agent-workspace-policy.store'

type GateRuntime = ReturnType<typeof createBaishouAgentGate>

type ScopeKey = 'companion' | `workspace:${string}`

interface ScopedRuntime {
  key: ScopeKey
  scope: AgentGateConfigScope
  runtime: GateRuntime
}

const sharedEventBus = new BaishouAgentGateEventBus()
let companionRuntime: ScopedRuntime | null = null
const workspaceRuntimes = new Map<string, ScopedRuntime>()
/** requestId → scope key，用于 reply 路由 */
const requestScopeIndex = new Map<string, ScopeKey>()
let bridgeRegistered = false
let lifecycleBridgeUnsub: (() => void) | null = null
let busIndexSubscribed = false

function scopeKeyOf(scope: AgentGateConfigScope): ScopeKey {
  return scope.kind === 'companion' ? 'companion' : `workspace:${scope.workspaceId}`
}

function parseScopeKey(key: ScopeKey): AgentGateConfigScope {
  if (key === 'companion') return { kind: 'companion' }
  return { kind: 'workspace', workspaceId: key.slice('workspace:'.length) }
}

async function loadCompanionConfig(): Promise<BaishouAgentGateConfig> {
  const saved = await settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)
  return cloneBaishouAgentGateConfig(saved, DEFAULT_BAISHOU_AGENT_GATE_CONFIG)
}

async function persistCompanionConfig(config: BaishouAgentGateConfig): Promise<void> {
  await settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, config)
}

async function persistWorkspaceConfig(
  workspaceId: string,
  config: BaishouAgentGateConfig
): Promise<void> {
  await setWorkspaceGateConfig(workspaceId, config)
}

function allScopedRuntimes(): ScopedRuntime[] {
  const list: ScopedRuntime[] = []
  if (companionRuntime) list.push(companionRuntime)
  for (const rt of workspaceRuntimes.values()) list.push(rt)
  return list
}

function ensureRequestIndexSubscription(): void {
  if (busIndexSubscribed) return
  busIndexSubscribed = true
  sharedEventBus.subscribe((event) => {
    if (event.type !== 'agent_gate.asked') return
    for (const scoped of allScopedRuntimes()) {
      if (scoped.runtime.gate.get(event.request.id)) {
        requestScopeIndex.set(event.request.id, scoped.key)
        break
      }
    }
  })
}

function createScopedRuntime(
  scope: AgentGateConfigScope,
  config: BaishouAgentGateConfig
): ScopedRuntime {
  ensureRequestIndexSubscription()
  const key = scopeKeyOf(scope)
  let runtimeRef: GateRuntime | null = null
  const persistConfig = async () => {
    if (!runtimeRef) return
    if (scope.kind === 'companion') {
      await persistCompanionConfig(runtimeRef.getConfig())
    } else {
      await persistWorkspaceConfig(scope.workspaceId, runtimeRef.getConfig())
    }
  }
  runtimeRef = createBaishouAgentGate({
    config,
    persistConfig,
    eventBus: sharedEventBus,
    configScope: scope
  })
  return { key, scope, runtime: runtimeRef }
}

function ensureLifecycleBridge(): void {
  if (!lifecycleBridgeUnsub) {
    lifecycleBridgeUnsub = bridgeAgentGateEventBus(sharedEventBus)
  }
}

export async function ensureCompanionGateRuntime(): Promise<GateRuntime> {
  if (!companionRuntime) {
    const config = await loadCompanionConfig()
    companionRuntime = createScopedRuntime({ kind: 'companion' }, config)
    ensureLifecycleBridge()
  }
  return companionRuntime.runtime
}

export async function ensureWorkspaceGateRuntime(workspaceId: string): Promise<GateRuntime> {
  const existing = workspaceRuntimes.get(workspaceId)
  if (existing) return existing.runtime

  const config = cloneBaishouAgentGateConfig(
    await getWorkspaceGateConfig(workspaceId),
    DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
  )
  const scoped = createScopedRuntime({ kind: 'workspace', workspaceId }, config)
  workspaceRuntimes.set(workspaceId, scoped)
  ensureLifecycleBridge()
  return scoped.runtime
}

/** @deprecated 使用 ensureCompanionGateRuntime */
export async function ensureAgentGateRuntime(): Promise<GateRuntime> {
  return ensureCompanionGateRuntime()
}

export async function getAgentGate(): Promise<BaishouAgentGateService> {
  return (await ensureCompanionGateRuntime()).gate
}

export async function getCompanionAgentGate(): Promise<BaishouAgentGateService> {
  return (await ensureCompanionGateRuntime()).gate
}

export async function getWorkspaceAgentGate(workspaceId: string): Promise<BaishouAgentGateService> {
  return (await ensureWorkspaceGateRuntime(workspaceId)).gate
}

export async function getAgentGateAllowlistStore(): Promise<BaishouAgentGateAllowlistStore> {
  return (await ensureCompanionGateRuntime()).allowlistStore
}

export async function getAgentGateConfig(): Promise<BaishouAgentGateConfig> {
  return (await ensureCompanionGateRuntime()).getConfig()
}

export async function getScopedAgentGateConfig(
  scope: AgentGateConfigScope
): Promise<BaishouAgentGateConfig> {
  if (scope.kind === 'companion') {
    return (await ensureCompanionGateRuntime()).getConfig()
  }
  return (await ensureWorkspaceGateRuntime(scope.workspaceId)).getConfig()
}

export async function patchScopedAgentGateConfig(
  scope: AgentGateConfigScope,
  patch: Partial<BaishouAgentGateConfig>
): Promise<BaishouAgentGateConfig> {
  const rt =
    scope.kind === 'companion'
      ? await ensureCompanionGateRuntime()
      : await ensureWorkspaceGateRuntime(scope.workspaceId)
  const next = rt.getConfig()
  if (patch.trustMode !== undefined) next.trustMode = patch.trustMode
  if (Array.isArray(patch.allowlist)) next.allowlist = [...patch.allowlist]
  if (Array.isArray(patch.exclusionList)) next.exclusionList = [...patch.exclusionList]
  if (patch.permissionRules !== undefined) {
    next.permissionRules = patch.permissionRules?.map((rule) => ({ ...rule }))
  }
  if (patch.actionRules !== undefined) {
    next.actionRules = patch.actionRules ? { ...patch.actionRules } : undefined
  }
  if (typeof patch.hideDeniedTools === 'boolean') next.hideDeniedTools = patch.hideDeniedTools
  if (typeof patch.forceAskExternalPath === 'boolean') {
    next.forceAskExternalPath = patch.forceAskExternalPath
  }
  if (
    patch.externalPathEffect === 'ask' ||
    patch.externalPathEffect === 'allow' ||
    patch.externalPathEffect === 'deny'
  ) {
    next.externalPathEffect = patch.externalPathEffect
  }
  if (Array.isArray(patch.trustedExternalDirs)) {
    next.trustedExternalDirs = [...patch.trustedExternalDirs]
  }
  if (typeof patch.repeatAssertAskThreshold === 'number') {
    next.repeatAssertAskThreshold = patch.repeatAssertAskThreshold
  }

  if (scope.kind === 'companion') {
    await persistCompanionConfig(next)
  } else {
    await persistWorkspaceConfig(scope.workspaceId, next)
  }
  return cloneBaishouAgentGateConfig(
    next,
    scope.kind === 'companion'
      ? DEFAULT_BAISHOU_AGENT_GATE_CONFIG
      : DEFAULT_WORKSPACE_AGENT_GATE_CONFIG
  )
}

export async function setAgentGateTrustMode(
  trustMode: AgentGateTrustMode,
  scope: AgentGateConfigScope = { kind: 'companion' }
): Promise<BaishouAgentGateConfig> {
  return patchScopedAgentGateConfig(scope, { trustMode })
}

export async function removeAgentGateAllowlistEntry(
  id: string,
  scope: AgentGateConfigScope = { kind: 'companion' }
): Promise<boolean> {
  const rt =
    scope.kind === 'companion'
      ? await ensureCompanionGateRuntime()
      : await ensureWorkspaceGateRuntime(scope.workspaceId)
  const removed = rt.allowlistStore.remove(id)
  if (!removed) return false
  await rt.allowlistStore.persist()
  sharedEventBus.publish({
    type: 'agent_gate.allowlist_changed',
    allowlist: rt.allowlistStore.list(),
    scope
  })
  return true
}

export async function replyAgentGate(input: AgentGateReplyInput): Promise<void> {
  const key = requestScopeIndex.get(input.requestId)
  let gate: BaishouAgentGateService | undefined

  if (key) {
    const scope = parseScopeKey(key)
    gate =
      scope.kind === 'companion'
        ? (await ensureCompanionGateRuntime()).gate
        : (await ensureWorkspaceGateRuntime(scope.workspaceId)).gate
  } else {
    for (const scoped of allScopedRuntimes()) {
      if (scoped.runtime.gate.get(input.requestId)) {
        gate = scoped.runtime.gate
        requestScopeIndex.set(input.requestId, scoped.key)
        break
      }
    }
    if (!gate) {
      gate = (await ensureCompanionGateRuntime()).gate
    }
  }

  await gate.reply(input)
  requestScopeIndex.delete(input.requestId)
}

export function cancelAgentGateSession(sessionId: string, reason?: string): void {
  for (const scoped of allScopedRuntimes()) {
    scoped.runtime.gate.cancelSession(sessionId, reason)
  }
}

export function cancelAllAgentGateSessions(reason?: string): void {
  for (const scoped of allScopedRuntimes()) {
    const sessionIds = new Set(
      scoped.runtime.gate.listPending().map((request) => request.sessionId)
    )
    for (const sessionId of sessionIds) {
      scoped.runtime.gate.cancelSession(sessionId, reason)
    }
  }
}

/** 聚合全部作用域的 pending（可选按 session 过滤）；供渲染进程水合 */
export function listPendingAgentGateRequests(
  sessionId?: string
): import('@baishou/shared').AgentGateRequest[] {
  const byId = new Map<string, import('@baishou/shared').AgentGateRequest>()
  for (const scoped of allScopedRuntimes()) {
    for (const request of scoped.runtime.gate.listPending(sessionId)) {
      byId.set(request.id, request)
    }
  }
  return [...byId.values()].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    return a.id.localeCompare(b.id)
  })
}

/** Vault 切换：取消挂起请求并丢弃运行时，下次按新 Vault 配置重建 */
export function resetAgentGateRuntimes(reason = 'vault-switch'): void {
  cancelAllAgentGateSessions(reason)
  companionRuntime = null
  workspaceRuntimes.clear()
  requestScopeIndex.clear()
}

/** 将门控 asked / allowlist 事件广播到所有渲染进程窗口 */
export function registerAgentGateEventBridge(): void {
  if (bridgeRegistered) return
  bridgeRegistered = true

  void ensureCompanionGateRuntime().then(async () => {
    const { closeAgentGateNotification, isAnyAgentGateWindowFocused, notifyAgentGateAsked } =
      await import('./agent-gate-notification.service')

    sharedEventBus.subscribe((event) => {
      if (event.type === 'agent_gate.asked') {
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('agent-gate:asked', event.request)
          }
        }
        if (!isAnyAgentGateWindowFocused()) {
          void notifyAgentGateAsked(event.request)
        } else {
          // 聚焦时由渲染进程判断是否目标会话，非目标则 force 通知
          for (const win of BrowserWindow.getAllWindows()) {
            if (!win.isDestroyed()) {
              win.webContents.send('agent-gate:focus-check', event.request)
            }
          }
        }
        return
      }

      if (event.type === 'agent_gate.replied') {
        closeAgentGateNotification(event.requestId)
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
        const payload: {
          allowlist: AgentGateAllowlistEntry[]
          scope?: AgentGateConfigScope
        } = {
          allowlist: event.allowlist,
          scope: event.scope
        }
        for (const win of BrowserWindow.getAllWindows()) {
          if (!win.isDestroyed()) {
            win.webContents.send('agent-gate:allowlist-changed', payload)
          }
        }
      }
    })
  })
}
