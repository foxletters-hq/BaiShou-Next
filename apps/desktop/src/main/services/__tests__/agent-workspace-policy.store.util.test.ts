import { describe, expect, it } from 'vitest'
import {
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  AgentGateEffect,
  cloneBaishouAgentGateConfig,
  cloneWorkspaceToolManagementConfig,
  hasCatchAllAllowRule,
  normalizeWorkspacePersonalMemoryReadEnabled,
  applyWorkspacePolicyPatch,
  resolveWorkspacePolicyFields
} from '@baishou/shared'

/**
 * Store 依赖 Electron app paths；此处验证迁移默认值与克隆隔离语义，
 * 与 agent-workspace-policy.store 使用同一套 shared helpers。
 */
describe('workspace policy defaults (migration safety)', () => {
  it('fresh workspace policy never inherits companion FullTrust catch-all', () => {
    const companionLike = cloneBaishouAgentGateConfig({
      exclusionList: ['diary_delete'],
      allowlist: [{ id: 'x', action: 'diary_write', createdAt: 1 }],
      hideDeniedTools: true,
      permissionRules: [{ action: '*', effect: AgentGateEffect.Allow }]
    })
    const workspaceFresh = cloneBaishouAgentGateConfig(null, DEFAULT_WORKSPACE_AGENT_GATE_CONFIG)

    expect(hasCatchAllAllowRule(companionLike)).toBe(true)
    expect(hasCatchAllAllowRule(workspaceFresh)).toBe(false)
    expect(workspaceFresh.allowlist).toEqual([])
    expect(workspaceFresh.exclusionList).toEqual([])
  })

  it('migrates legacy trustMode full_trust to catch-all allow', () => {
    const migrated = cloneBaishouAgentGateConfig({
      exclusionList: ['diary_delete'],
      allowlist: [],
      trustMode: 'full_trust'
    } as never)

    expect(hasCatchAllAllowRule(migrated)).toBe(true)
    expect((migrated as { trustMode?: unknown }).trustMode).toBeUndefined()
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

  it('treats missing personalMemoryReadEnabled as on', () => {
    expect(normalizeWorkspacePersonalMemoryReadEnabled(undefined)).toBe(true)
    expect(normalizeWorkspacePersonalMemoryReadEnabled(null)).toBe(true)
    expect(normalizeWorkspacePersonalMemoryReadEnabled(true)).toBe(true)
    expect(normalizeWorkspacePersonalMemoryReadEnabled(false)).toBe(false)
    expect(resolveWorkspacePolicyFields(undefined).personalMemoryReadEnabled).toBe(true)
    expect(resolveWorkspacePolicyFields({}).personalMemoryReadEnabled).toBe(true)
    expect(
      resolveWorkspacePolicyFields({ personalMemoryReadEnabled: false }).personalMemoryReadEnabled
    ).toBe(false)
  })

  it('keeps personal memory flag when only tool management is patched', () => {
    const current = resolveWorkspacePolicyFields({
      personalMemoryReadEnabled: false,
      toolManagement: {
        disabledToolIds: ['workspace_run'],
        customConfigs: {}
      }
    })
    const afterTools = applyWorkspacePolicyPatch(current, {
      toolManagement: {
        disabledToolIds: [],
        customConfigs: {}
      }
    })
    expect(afterTools.personalMemoryReadEnabled).toBe(false)
    expect(afterTools.toolManagement.disabledToolIds).toEqual([])
  })
})
