import { describe, expect, it } from 'vitest'
import {
  resolveAggregateSnapshots,
  synthesizePortableSnapshotFromMessages
} from '../session-compression-snapshot.util'

describe('session-compression-snapshot.util', () => {
  it('prefers snapshots[] from the file', () => {
    const snapshots = resolveAggregateSnapshots({
      snapshots: [
        {
          coveredUpToMessageId: 'm2',
          tailStartMessageId: 'm3',
          summaryText: '摘要',
          messageCount: 2,
          tokenCount: 10,
          createdAt: 1_700_000_000_000
        }
      ],
      messages: []
    })
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.coveredUpToMessageId).toBe('m2')
    expect(snapshots[0]?.tailStartMessageId).toBe('m3')
  })

  it('synthesizes one row from the latest completed compaction part', () => {
    const snap = synthesizePortableSnapshotFromMessages([
      { id: 'm1', parts: [] },
      {
        id: 'm2',
        parts: [
          {
            type: 'compaction',
            data: {
              status: 'completed',
              coveredUpToMessageId: 'm2',
              streamTranscript: '往期摘要',
              compressedAt: 1_700_000_000_000
            }
          }
        ]
      },
      { id: 'm3', parts: [] }
    ])
    expect(snap).toMatchObject({
      coveredUpToMessageId: 'm2',
      tailStartMessageId: 'm3',
      summaryText: '往期摘要'
    })
  })
})
