import { describe, it, expect } from 'vitest'
import {
  selectLatestSnapshotForBranch,
  remapSnapshotAnchorToBranch,
  isSnapshotAnchorInCopiedSet
} from '../agent/session-branch.compression'
import type { Snapshot } from '@baishou/database'

function snap(
  id: number,
  coveredUpToMessageId: string,
  createdAt: Date
): Snapshot {
  return {
    id,
    sessionId: 'src',
    summaryText: `summary-${id}`,
    coveredUpToMessageId,
    tailStartMessageId: null,
    messageCount: id * 10,
    tokenCount: null,
    createdAt
  }
}

describe('session-branch.compression', () => {
  const copiedMessages = [
    { id: 'm1', orderIndex: 1 },
    { id: 'm2', orderIndex: 2 },
    { id: 'm3', orderIndex: 3 }
  ]
  const copiedIds = new Set(copiedMessages.map((m) => m.id))

  it('selectLatestSnapshotForBranch picks newest snapshot still inside branch', () => {
    const snapshots = [
      snap(1, 'm1', new Date('2024-01-01')),
      snap(2, 'm9', new Date('2024-02-01')),
      snap(3, 'm2', new Date('2024-03-01'))
    ]
    const picked = selectLatestSnapshotForBranch(snapshots, copiedIds, copiedMessages)
    expect(picked?.id).toBe(3)
    expect(picked?.coveredUpToMessageId).toBe('m2')
  })

  it('isSnapshotAnchorInCopiedSet supports legacy orderIndex anchors', () => {
    expect(isSnapshotAnchorInCopiedSet(snap(1, '2', new Date()), copiedIds, copiedMessages)).toBe(
      true
    )
    expect(isSnapshotAnchorInCopiedSet(snap(1, '99', new Date()), copiedIds, copiedMessages)).toBe(
      false
    )
  })

  it('remapSnapshotAnchorToBranch maps to new message ids', () => {
    const idMap = new Map([
      ['m1', 'new-m1'],
      ['m2', 'new-m2']
    ])
    expect(remapSnapshotAnchorToBranch(snap(1, 'm2', new Date()), idMap, copiedMessages)).toBe(
      'new-m2'
    )
    expect(remapSnapshotAnchorToBranch(snap(1, '2', new Date()), idMap, copiedMessages)).toBe(
      'new-m2'
    )
  })
})
