import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  reconcileCompressionStateAfterTruncate,
  truncateSessionAfterOrderIndex
} from '../agent/session-truncate.utils'

describe('session-truncate.utils', () => {
  const sessionRepo = {
    deleteMessagesAfter: vi.fn(),
    clearCompactionMarkersFromOrderIndex: vi.fn(),
    getMessagesBySession: vi.fn()
  }
  const snapshotRepo = {
    listSnapshotsBySession: vi.fn(),
    deleteSnapshots: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sessionRepo.getMessagesBySession.mockResolvedValue([
      { id: 'u1', orderIndex: 0 },
      { id: 'u2', orderIndex: 1 },
      { id: 'u3', orderIndex: 2 }
    ])
    snapshotRepo.listSnapshotsBySession.mockResolvedValue([
      { id: 101, coveredUpToMessageId: 'u2', tailStartMessageId: 'u3' }
    ])
  })

  it('truncateSessionAfterOrderIndex deletes tail, clears markers, and prunes snapshots', async () => {
    await truncateSessionAfterOrderIndex(sessionRepo as any, snapshotRepo as any, 'sess-1', 5)

    expect(sessionRepo.deleteMessagesAfter).toHaveBeenCalledWith('sess-1', 5)
    expect(sessionRepo.clearCompactionMarkersFromOrderIndex).toHaveBeenCalledWith('sess-1', 5)
    expect(snapshotRepo.deleteSnapshots).not.toHaveBeenCalled()
  })

  it('should delete snapshot when covered message is truncated', async () => {
    sessionRepo.getMessagesBySession.mockResolvedValue([
      { id: 'u1', orderIndex: 0 },
      { id: 'u2', orderIndex: 1 }
    ])

    await reconcileCompressionStateAfterTruncate(
      sessionRepo as any,
      snapshotRepo as any,
      'sess-1',
      1
    )

    expect(snapshotRepo.deleteSnapshots).toHaveBeenCalledWith('sess-1', [101])
  })

  it('should delete snapshot when clearMarkersFromOrderIndex is less than or equal to covered message order', async () => {
    await reconcileCompressionStateAfterTruncate(
      sessionRepo as any,
      snapshotRepo as any,
      'sess-1',
      1
    )

    expect(snapshotRepo.deleteSnapshots).toHaveBeenCalledWith('sess-1', [101])
  })

  it('should keep snapshot when clearMarkersFromOrderIndex is greater than covered and tail start message orders', async () => {
    await reconcileCompressionStateAfterTruncate(
      sessionRepo as any,
      snapshotRepo as any,
      'sess-1',
      5
    )

    expect(snapshotRepo.deleteSnapshots).not.toHaveBeenCalled()
  })
})
