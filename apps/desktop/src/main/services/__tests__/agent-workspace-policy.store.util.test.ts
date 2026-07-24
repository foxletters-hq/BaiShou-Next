import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  AgentGateTrustMode,
  cloneBaishouAgentGateConfig,
  cloneWorkspaceToolManagementConfig
} from '@baishou/shared'

/**
 * Store 依赖 Electron app paths；此处验证迁移默认值与克隆隔离语义，
 * 与 agent-workspace-policy.store 使用同一套 shared helpers。
 */
describe('workspace policy defaults (migration safety)', () => {
  it('fresh workspace policy never inherits companion FullTrust allowlist', () => {
    const companionLike = cloneBaishouAgentGateConfig({
      trustMode: AgentGateTrustMode.FullTrust,
      exclusionList: ['diary_delete'],
      allowlist: [{ id: 'x', action: 'diary_write', createdAt: 1 }],
      hideDeniedTools: true
    })
    const workspaceFresh = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)

    expect(companionLike.trustMode).toBe(AgentGateTrustMode.FullTrust)
    expect(workspaceFresh.trustMode).toBe(AgentGateTrustMode.Manual)
    expect(workspaceFresh.allowlist).toEqual([])
    expect(workspaceFresh.exclusionList).toEqual(['workspace_delete'])
  })

  it('clones tool management without sharing nested customConfigs', () => {
    const a = cloneWorkspaceToolManagementConfig({
      disabledToolIds: ['workspace_run'],
      customConfigs: { workspace_run: { timeout: 1 } }
    })
    const b = cloneWorkspaceToolManagementConfig(a)
    b.disabledToolIds.push('workspace_write')
    b.customConfigs.workspace_run = { timeout: 2 }

    expect(a.disabledToolIds).toEqual(['workspace_run'])
    expect(a.customConfigs.workspace_run).toEqual({ timeout: 1 })
  })
})
