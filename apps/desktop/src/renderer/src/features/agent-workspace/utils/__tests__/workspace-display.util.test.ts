import { describe, expect, it } from 'vitest'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import { formatCompactRelativeTime, sortAgentWorkspaces } from '../workspace-display.util'

function workspace(
  id: string,
  updatedAt: string,
  pinnedAt?: string | null
): AgentWorkspaceEntry {
  return {
    id,
    folderRoot: `D:/${id}`,
    displayName: id,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
    pinnedAt
  }
}

describe('formatCompactRelativeTime', () => {
  const now = Date.parse('2026-08-19T18:00:00.000Z')

  it('uses m and h for recent session times', () => {
    expect(formatCompactRelativeTime('2026-08-19T17:59:30.000Z', now)).toBe('刚刚')
    expect(formatCompactRelativeTime('2026-08-19T17:17:00.000Z', now)).toBe('43m')
    expect(formatCompactRelativeTime('2026-08-19T11:00:00.000Z', now)).toBe('7h')
    expect(formatCompactRelativeTime('2026-08-17T18:00:00.000Z', now)).toBe('2天')
  })
})

describe('sortAgentWorkspaces', () => {
  it('moves pinned workspaces above last-active and more recent ones', () => {
    const sorted = sortAgentWorkspaces(
      [
        workspace('recent', '2026-08-14T00:00:00.000Z'),
        workspace('active', '2026-08-10T00:00:00.000Z'),
        workspace('pinned', '2026-01-01T00:00:00.000Z', '2026-08-15T00:00:00.000Z')
      ],
      'active'
    )
    expect(sorted.map((item) => item.id)).toEqual(['pinned', 'active', 'recent'])
  })
})
