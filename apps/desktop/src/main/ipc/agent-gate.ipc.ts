import { ipcMain } from 'electron'
import type { AgentGateReplyInput, AgentGateTrustMode } from '@baishou/shared'
import {
  getAgentGate,
  getAgentGateConfig,
  removeAgentGateAllowlistEntry,
  setAgentGateTrustMode,
  registerAgentGateEventBridge
} from '../services/agent-gate.service'

export function registerAgentGateIPC(): void {
  registerAgentGateEventBridge()

  ipcMain.handle('agent-gate:reply', async (_, input: AgentGateReplyInput) => {
    const gate = await getAgentGate()
    await gate.reply(input)
    return { success: true }
  })

  ipcMain.handle('agent-gate:get-config', async () => {
    return getAgentGateConfig()
  })

  ipcMain.handle('agent-gate:set-trust-mode', async (_, trustMode: AgentGateTrustMode) => {
    return setAgentGateTrustMode(trustMode)
  })

  ipcMain.handle('agent-gate:remove-allowlist-entry', async (_, entryId: string) => {
    const removed = await removeAgentGateAllowlistEntry(entryId)
    return { success: removed }
  })
}
