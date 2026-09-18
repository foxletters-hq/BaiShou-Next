import {
  applyWorkspaceSecurityModeToConfig,
  type AgentWorkspaceSecurityMode,
  type BaishouAgentGateConfig
} from '@baishou/shared'

export async function persistSecurityMode(params: {
  workspaceId: string
  mode: AgentWorkspaceSecurityMode
  currentGate: BaishouAgentGateConfig | null
}): Promise<BaishouAgentGateConfig> {
  const current =
    params.currentGate ??
    (await window.api.settings.getBaishouAgentGateConfig({
      kind: 'workspace',
      workspaceId: params.workspaceId
    }))
  const next = applyWorkspaceSecurityModeToConfig(current, params.mode)
  return window.api.settings.setBaishouAgentGateConfig(next, {
    kind: 'workspace',
    workspaceId: params.workspaceId
  })
}
