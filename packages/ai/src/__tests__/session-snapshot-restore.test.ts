import { describe, expect, it, vi } from 'vitest'
import { ensureSessionSnapshotsRestored } from '../agent/session-snapshot-restore'

describe('ensureSessionSnapshotsRestored', () => {
  it('returns the table snapshot when present', async () => {
    const existing = { id: 1, summaryText: '已有', coveredUpToMessageId: 'm1' }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValue(existing),
      replaceSnapshotsForSession: vi.fn()
    }
    const sessionRepo = { getSessionAggregate: vi.fn() }
    const result = await ensureSessionSnapshotsRestored(
      's1',
      snapshotRepo as never,
      sessionRepo as never
    )
    expect(result).toBe(existing)
    expect(sessionRepo.getSessionAggregate).not.toHaveBeenCalled()
  })

  it('restores from compaction parts when the table is empty', async () => {
    const restored = { id: 2, summaryText: '恢复', coveredUpToMessageId: 'm2' }
    const snapshotRepo = {
      getLatestSnapshot: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(restored),
      replaceSnapshotsForSession: vi.fn().mockResolvedValue(undefined)
    }
    const sessionRepo = {
      getSessionAggregate: vi.fn().mockResolvedValue({
        session: { id: 's1' },
        messages: [
          {
            id: 'm2',
            parts: [
              {
                type: 'compaction',
                data: {
                  status: 'completed',
                  coveredUpToMessageId: 'm2',
                  streamTranscript: '恢复'
                }
              }
            ]
          },
          { id: 'm3', parts: [] }
        ]
      })
    }
    const result = await ensureSessionSnapshotsRestored(
      's1',
      snapshotRepo as never,
      sessionRepo as never
    )
    expect(snapshotRepo.replaceSnapshotsForSession).toHaveBeenCalledWith(
      's1',
      expect.arrayContaining([
        expect.objectContaining({
          coveredUpToMessageId: 'm2',
          tailStartMessageId: 'm3',
          summaryText: '恢复'
        })
      ])
    )
    expect(result).toBe(restored)
  })
})
