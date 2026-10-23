import { describe, expect, it } from 'vitest'
import {
  AgentGateProfileId,
  DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
  deriveLegacyVaultId,
  WORKSPACE_PERSONAL_MEMORY_READONLY_TOOL_IDS
} from '@baishou/shared'
import { createBaishouAgentGate } from '../baishou-agent-gate/baishou-agent-gate.service'
import { ToolRegistry } from '../tools/tool-registry'

const workspaceContext = {
  sessionId: 'ws-session',
  vaultId: deriveLegacyVaultId('Personal'),
  vaultName: 'Personal',
  workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' as const }
}

describe('ToolRegistry workspace session', () => {
  const registry = new ToolRegistry()

  it('enables workspace tools when folderRoot is set', () => {
    const enabled = registry.getEnabledToolsRaw({
      sessionId: 's1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' }
    })
    const names = enabled.map((tool) => tool.name)
    expect(names).toContain('workspace_read')
    expect(names).not.toContain('diary_write')
  })

  it('exposes personal memory read tools by default', () => {
    const enabled = registry.getEnabledToolsRaw({
      ...workspaceContext,
      userConfig: { hasEmbeddingModel: true, ragEnabled: true }
    })
    const names = enabled.map((tool) => tool.name)
    for (const id of WORKSPACE_PERSONAL_MEMORY_READONLY_TOOL_IDS) {
      expect(names).toContain(id)
    }
    expect(names).toContain('knowledge_search')
    expect(names).not.toContain('diary_write')
    expect(names).not.toContain('diary_edit')
    expect(names).not.toContain('diary_delete')
    expect(names).not.toContain('memory_store')
    expect(names).not.toContain('memory_delete')
    expect(names).not.toContain('graph_upsert')
    expect(names).not.toContain('recall_relations')
  })

  it('hides personal memory read tools when the workspace switch is off', () => {
    const enabled = registry.getEnabledToolsRaw({
      ...workspaceContext,
      userConfig: {
        personalMemoryReadEnabled: false,
        hasEmbeddingModel: true,
        ragEnabled: true
      }
    })
    const names = enabled.map((tool) => tool.name)
    for (const id of WORKSPACE_PERSONAL_MEMORY_READONLY_TOOL_IDS) {
      expect(names).not.toContain(id)
    }
    expect(names).toContain('knowledge_search')
    expect(names).toContain('knowledge_graph_search')
    expect(names).toContain('workspace_read')
  })

  it('keeps personal memory reads visible under workspace hideDeniedTools', () => {
    const { gate } = createBaishouAgentGate({
      config: {
        ...DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
        hideDeniedTools: true
      }
    })
    const enabled = registry.getEnabledToolsRaw({
      ...workspaceContext,
      gateProfile: AgentGateProfileId.Workspace,
      agentGate: gate,
      userConfig: {
        hasEmbeddingModel: true,
        ragEnabled: true,
        personalMemoryReadEnabled: true,
        baishou_agent_gate_config: { hideDeniedTools: true }
      }
    })
    const names = enabled.map((tool) => tool.name)
    for (const id of WORKSPACE_PERSONAL_MEMORY_READONLY_TOOL_IDS) {
      expect(names).toContain(id)
    }
    expect(names).not.toContain('diary_write')
    expect(names).not.toContain('diary_edit')
    expect(names).not.toContain('memory_store')
    expect(names).not.toContain('graph_upsert')
  })

  it('hides personal memory reads under workspace hideDeniedTools when the switch is off', () => {
    const { gate } = createBaishouAgentGate({
      config: {
        ...DEFAULT_WORKSPACE_AGENT_GATE_CONFIG,
        hideDeniedTools: true
      }
    })
    const enabled = registry.getEnabledToolsRaw({
      ...workspaceContext,
      gateProfile: AgentGateProfileId.Workspace,
      agentGate: gate,
      userConfig: {
        hasEmbeddingModel: true,
        ragEnabled: true,
        personalMemoryReadEnabled: false,
        baishou_agent_gate_config: { hideDeniedTools: true }
      }
    })
    const names = enabled.map((tool) => tool.name)
    for (const id of WORKSPACE_PERSONAL_MEMORY_READONLY_TOOL_IDS) {
      expect(names).not.toContain(id)
    }
    expect(names).toContain('workspace_read')
    expect(names).not.toContain('diary_write')
  })

  it('keeps vector_search gated by embedding even when personal memory is on', () => {
    expect(
      registry.isToolEnabled('vector_search', {
        ...workspaceContext,
        userConfig: { hasEmbeddingModel: false, ragEnabled: true }
      })
    ).toBe(false)
    expect(
      registry.isToolEnabled('diary_read', {
        ...workspaceContext,
        userConfig: { hasEmbeddingModel: false, ragEnabled: true }
      })
    ).toBe(true)
  })

  it('hides workspace tools for companion sessions', () => {
    const enabled = registry.getEnabledToolsRaw({
      sessionId: 's1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal'
    })
    const names = enabled.map((tool) => tool.name)
    expect(names).not.toContain('workspace_read')
    expect(names).toContain('diary_read')
  })

  it('does not expose graph tools in workspace sessions (G1.d)', () => {
    const enabled = registry.getEnabledToolsRaw({
      sessionId: 'ws-session',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' }
    })
    const names = enabled.map((tool) => tool.name)
    expect(names).not.toContain('graph_upsert')
    expect(names).not.toContain('recall_relations')
    expect(
      registry.isToolEnabled('graph_upsert', {
        sessionId: 'ws-session',
        vaultId: deriveLegacyVaultId('Personal'),
        vaultName: 'Personal',
        workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' }
      })
    ).toBe(false)
    expect(
      registry.isToolEnabled('recall_relations', {
        sessionId: 'ws-session',
        vaultId: deriveLegacyVaultId('Personal'),
        vaultName: 'Personal',
        workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' }
      })
    ).toBe(false)
  })

  it('exposes knowledge_search in workspace sessions (K1.3 whitelist)', () => {
    const enabled = registry.getEnabledToolsRaw({
      sessionId: 'ws-session',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' }
    })
    const names = enabled.map((tool) => tool.name)
    expect(names).toContain('knowledge_search')
    expect(names).toContain('knowledge_graph_search')
    expect(
      registry.isToolEnabled('knowledge_search', {
        sessionId: 'ws-session',
        vaultId: deriveLegacyVaultId('Personal'),
        vaultName: 'Personal',
        workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' }
      })
    ).toBe(true)
    expect(
      registry.isToolEnabled('knowledge_graph_search', {
        sessionId: 'ws-session',
        vaultId: deriveLegacyVaultId('Personal'),
        vaultName: 'Personal',
        workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' }
      })
    ).toBe(true)
  })

  it('keeps knowledge_search available for companion sessions', () => {
    const enabled = registry.getEnabledToolsRaw({
      sessionId: 's1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal'
    })
    const names = enabled.map((tool) => tool.name)
    expect(names).toContain('knowledge_search')
  })

  it('exposes web_search in workspace sessions when web_search_enabled', () => {
    const enabled = registry.getEnabledToolsRaw({
      sessionId: 'ws-session',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' },
      userConfig: { web_search_enabled: true }
    })
    const names = enabled.map((tool) => tool.name)
    expect(names).toContain('web_search')
    expect(names).toContain('url_read')
  })

  it('hides web_search in workspace sessions when web_search_enabled is off', () => {
    const enabled = registry.getEnabledToolsRaw({
      sessionId: 'ws-session',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' },
      userConfig: { web_search_enabled: false }
    })
    const names = enabled.map((tool) => tool.name)
    expect(names).not.toContain('web_search')
  })
})
