import { describe, expect, it } from 'vitest'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import {
  dedupeAgentWorkspacesByFolder,
  reconcileRegistryFromSessionBindings,
  resolveValidLastActiveWorkspaceId
} from '../agent-workspace-registry.util'

function entry(partial: Partial<AgentWorkspaceEntry> & Pick<AgentWorkspaceEntry, 'id' | 'folderRoot'>): AgentWorkspaceEntry {
  return {
    displayName: partial.displayName ?? 'workspace',
    avatarPath: partial.avatarPath ?? null,
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-01-02T00:00:00.000Z',
    ...partial
  }
}

describe('agent-workspace-registry.util', () => {
  it('dedupes workspaces by normalized folder path', () => {
    const deduped = dedupeAgentWorkspacesByFolder([
      entry({ id: 'a', folderRoot: 'D:/Projects/demo', updatedAt: '2026-01-01T00:00:00.000Z' }),
      entry({
        id: 'b',
        folderRoot: 'D:/Projects/Demo',
        updatedAt: '2026-01-03T00:00:00.000Z',
        avatarPath: 'file:///avatar.png'
      })
    ])

    expect(deduped).toHaveLength(1)
    expect(deduped[0]?.id).toBe('b')
  })

  it('adds missing registry rows from session bindings', () => {
    const merged = reconcileRegistryFromSessionBindings(
      [entry({ id: 'existing', folderRoot: 'D:/keep' })],
      [{ folderRoot: 'D:/new-binding', folderDisplayName: 'binding-name' }],
      () => 'generated-id',
      '2026-06-01T00:00:00.000Z'
    )

    expect(merged).toHaveLength(2)
    expect(merged.some((item) => item.id === 'generated-id')).toBe(true)
    expect(merged.find((item) => item.id === 'generated-id')?.displayName).toBe('binding-name')
  })

  it('clears stale last active workspace id after dedupe', () => {
    const workspaces = [entry({ id: 'kept', folderRoot: 'D:/demo' })]
    expect(resolveValidLastActiveWorkspaceId('removed', workspaces)).toBeUndefined()
    expect(resolveValidLastActiveWorkspaceId('kept', workspaces)).toBe('kept')
  })
})
