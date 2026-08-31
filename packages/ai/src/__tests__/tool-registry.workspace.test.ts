import { describe, expect, it } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
import { ToolRegistry } from '../tools/tool-registry'

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
