import { ipcMain } from 'electron'
import type {
  AgentGateConfigScope,
  AgentGateNotificationPrefs,
  AgentGateReplyInput,
  AgentGateRequest,
  AgentGateTrustMode
} from '@baishou/shared'
import {
  getAgentGateConfig,
  getScopedAgentGateConfig,
  listPendingAgentGateRequests,
  removeAgentGateAllowlistEntry,
  replyAgentGate,
  setAgentGateTrustMode,
  registerAgentGateEventBridge
} from '../services/agent-gate.service'
import {
  getAgentGateNotificationPrefs,
  setAgentGateNotificationPrefs
} from '../services/agent-gate-notification-prefs.store'
import { notifyAgentGateAsked } from '../services/agent-gate-notification.service'

function normalizeScope(scope?: AgentGateConfigScope | null): AgentGateConfigScope {
  if (scope?.kind === 'workspace' && typeof scope.workspaceId === 'string' && scope.workspaceId) {
    return { kind: 'workspace', workspaceId: scope.workspaceId }
  }
  return { kind: 'companion' }
}

export function registerAgentGateIPC(): void {
  registerAgentGateEventBridge()

  ipcMain.handle('agent-gate:reply', async (_, input: AgentGateReplyInput) => {
    await replyAgentGate(input)
    return { success: true }
  })

  ipcMain.handle('agent-gate:list-pending', async (_, sessionId?: string) => {
    return listPendingAgentGateRequests(
      typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : undefined
    )
  })

  ipcMain.handle('agent-gate:get-notification-prefs', async () => {
    return getAgentGateNotificationPrefs()
  })

  ipcMain.handle(
    'agent-gate:set-notification-prefs',
    async (_, prefs: Partial<AgentGateNotificationPrefs>) => {
      return setAgentGateNotificationPrefs(prefs ?? {})
    }
  )

  ipcMain.handle('agent-gate:notify-asked', async (_, request: AgentGateRequest) => {
    if (!request?.id || !request.sessionId) return { success: false }
    await notifyAgentGateAsked(request, { force: true })
    return { success: true }
  })

  ipcMain.handle('agent-gate:get-config', async (_, scope?: AgentGateConfigScope) => {
    return getScopedAgentGateConfig(normalizeScope(scope))
  })

  ipcMain.handle(
    'agent-gate:set-trust-mode',
    async (_, trustMode: AgentGateTrustMode, scope?: AgentGateConfigScope) => {
      return setAgentGateTrustMode(trustMode, normalizeScope(scope))
    }
  )

  ipcMain.handle(
    'agent-gate:remove-allowlist-entry',
    async (_, entryId: string, scope?: AgentGateConfigScope) => {
      const removed = await removeAgentGateAllowlistEntry(entryId, normalizeScope(scope))
      return { success: removed }
    }
  )

  // Compatibility alias used by older callers
  void getAgentGateConfig
}
