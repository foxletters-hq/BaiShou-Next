import { describe, expect, it } from 'vitest'
import type { AgentRoundCheckpoint } from '@baishou/shared'
import {
  applyRoundEndHandle,
  applyRoundStartHandle,
  noteTouchedPath,
  resolveRollbackPaths,
  toRoundEndHandle,
  toRoundStartHandle
} from '../checkpoint-snapshot.mapper'

function createCheckpoint(overrides: Partial<AgentRoundCheckpoint> = {}): AgentRoundCheckpoint {
  return {
    id: 'cp-1',
    sessionId: 'session-1',
    userMessageId: 'msg-1',
    createdAt: '2026-08-12T00:00:00.000Z',
    files: [],
    ...overrides
  }
}

describe('checkpoint snapshot mapper', () => {
  it('treats checkpoints written before shadow git as inline', () => {
    const legacy = createCheckpoint({
      files: [{ path: 'note.md', existed: true, beforeContent: 'old' }]
    })

    const handle = toRoundStartHandle(legacy)

    expect(handle).toEqual({
      kind: 'inline',
      files: [{ path: 'note.md', existed: true, beforeContent: 'old' }]
    })
    expect(toRoundEndHandle(legacy)).toBeNull()
  })

  it('reads a git snapshot back with its excluded paths', () => {
    const checkpoint = createCheckpoint({
      snapshotKind: 'git',
      startTreeOid: 'tree-start',
      endTreeOid: 'tree-end',
      excludedPaths: ['huge.bin']
    })

    expect(toRoundStartHandle(checkpoint)).toEqual({
      kind: 'git',
      treeOid: 'tree-start',
      excludedPaths: ['huge.bin']
    })
    expect(toRoundEndHandle(checkpoint)).toEqual({ kind: 'git', treeOid: 'tree-end' })
  })

  it('falls back to inline when a git checkpoint has no start tree', () => {
    const checkpoint = createCheckpoint({ snapshotKind: 'git' })
    expect(toRoundStartHandle(checkpoint).kind).toBe('inline')
  })

  it('stores a git handle without carrying file contents', () => {
    const checkpoint = createCheckpoint({
      files: [{ path: 'stale.md', existed: true, beforeContent: 'stale' }]
    })

    applyRoundStartHandle(checkpoint, {
      kind: 'git',
      treeOid: 'tree-start',
      excludedPaths: ['huge.bin']
    })
    applyRoundEndHandle(checkpoint, { kind: 'git', treeOid: 'tree-end' })

    expect(checkpoint).toMatchObject({
      snapshotKind: 'git',
      startTreeOid: 'tree-start',
      endTreeOid: 'tree-end',
      excludedPaths: ['huge.bin'],
      files: []
    })
  })

  it('keeps inline file entries when the store degraded', () => {
    const checkpoint = createCheckpoint()
    const files = [{ path: 'note.md', existed: false }]

    applyRoundStartHandle(checkpoint, { kind: 'inline', files })
    applyRoundEndHandle(checkpoint, { kind: 'inline', files })

    expect(checkpoint.snapshotKind).toBe('inline')
    expect(checkpoint.files).toBe(files)
    expect(checkpoint.endTreeOid).toBeUndefined()
  })

  it('records touched paths once each', () => {
    const checkpoint = createCheckpoint()

    noteTouchedPath(checkpoint, 'a.md')
    noteTouchedPath(checkpoint, 'a.md')
    noteTouchedPath(checkpoint, 'b.md')
    noteTouchedPath(checkpoint, '')

    expect(checkpoint.touchedPaths).toEqual(['a.md', 'b.md'])
  })

  it('merges attributed paths with whatever the snapshot can enumerate', () => {
    const checkpoint = createCheckpoint({ touchedPaths: ['written-by-agent.md', 'shared.md'] })

    expect(resolveRollbackPaths(checkpoint, ['shared.md', 'from-inline.md']).sort()).toEqual([
      'from-inline.md',
      'shared.md',
      'written-by-agent.md'
    ])
    expect(resolveRollbackPaths(checkpoint, null)).toEqual(['written-by-agent.md', 'shared.md'])
  })
})
