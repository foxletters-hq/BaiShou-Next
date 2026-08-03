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
    expect(registry.isToolEnabled('graph_upsert', {
      sessionId: 'ws-session',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' }
    })).toBe(false)
    expect(registry.isToolEnabled('recall_relations', {
      sessionId: 'ws-session',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal',
      workspace: { folderRoot: '/tmp/project', sessionKind: 'workspace' }
    })).toBe(false)
  })

  it('keeps graph tools available for companion sessions', () => {
    const enabled = registry.getEnabledToolsRaw({
      sessionId: 's1',
      vaultId: deriveLegacyVaultId('Personal'),
      vaultName: 'Personal'
    })
    const names = enabled.map((tool) => tool.name)
    expect(names).toContain('graph_upsert')
    expect(names).toContain('recall_relations')
  })
})
