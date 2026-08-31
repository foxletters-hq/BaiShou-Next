import { describe, expect, it } from 'vitest'
import type { AgentWorkspaceSessionListItem } from '@baishou/shared'
import {
  groupSessionsByTime,
  previewWorkspaceSessions,
  sortWorkspaceSessions
} from '../workbenchSessionGroups'

function session(
  id: string,
  updatedAt: string,
  isPinned = false
): AgentWorkspaceSessionListItem {
  return {
    sessionId: id,
    title: id,
    folderRoot: '/tmp',
    folderDisplayName: 'tmp',
    updatedAt,
    isPinned
  }
}

describe('workbenchSessionGroups', () => {
  it('sorts pinned sessions first, then by updatedAt', () => {
    const sorted = sortWorkspaceSessions([
      session('old', '2026-08-01T00:00:00.000Z'),
      session('pinned-old', '2026-07-01T00:00:00.000Z', true),
      session('new', '2026-08-10T00:00:00.000Z'),
      session('pinned-new', '2026-08-11T00:00:00.000Z', true)
    ])
    expect(sorted.map((row) => row.sessionId)).toEqual([
      'pinned-new',
      'pinned-old',
      'new',
      'old'
    ])
  })

  it('keeps all pinned sessions in the preview', () => {
    const { preview, hasMore } = previewWorkspaceSessions(
      [
        session('p1', '2026-08-01T00:00:00.000Z', true),
        session('p2', '2026-08-02T00:00:00.000Z', true),
        session('p3', '2026-08-03T00:00:00.000Z', true),
        session('a', '2026-08-10T00:00:00.000Z'),
        session('b', '2026-08-09T00:00:00.000Z')
      ],
      2
    )
    expect(preview.map((row) => row.sessionId)).toEqual(['p3', 'p2', 'p1'])
    expect(hasMore).toBe(true)
  })

  it('groups pinned sessions separately from time buckets', () => {
    const groups = groupSessionsByTime([
      session('pinned', new Date().toISOString(), true),
      session('today', new Date().toISOString())
    ])
    expect(groups.map((group) => group.key)).toEqual(['pinned', 'today'])
    expect(groups[0]?.sessions.map((row) => row.sessionId)).toEqual(['pinned'])
  })
})
