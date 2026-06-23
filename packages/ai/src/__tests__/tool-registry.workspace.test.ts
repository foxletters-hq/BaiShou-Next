import { describe, expect, it } from 'vitest'
import { ToolRegistry } from '../tools/tool-registry'

describe('ToolRegistry workspace session', () => {
  const registry = new ToolRegistry()

  it('enables workspace tools when folderRoot is set', () => {
    const enabled = registry.getEnabledToolsRaw({
      sessionId: 's1',
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
      vaultName: 'Personal'
    })
    const names = enabled.map((tool) => tool.name)
    expect(names).not.toContain('workspace_read')
    expect(names).toContain('diary_read')
  })
})
