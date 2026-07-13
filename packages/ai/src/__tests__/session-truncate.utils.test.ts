import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  reconcileCompressionStateAfterTruncate,
  truncateSessionAfterOrderIndex
} from '../agent/session-truncate.utils'

describe('session-truncate.utils', () => {
  const sessionRepo = {
    deleteMessagesAfter: vi.fn(),
    clearCompactionMarkersFromOrderIndex: vi.fn(),
    getMessagesBySession: vi.fn(),
    listMessageIdsAfterOrderIndex: vi.fn(),
    getPartsByMessageIds: vi.fn()
  }
  const snapshotRepo = {
    listSnapshotsBySession: vi.fn(),
    deleteSnapshots: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    sessionRepo.listMessageIdsAfterOrderIndex.mockResolvedValue([])
    sessionRepo.getPartsByMessageIds.mockResolvedValue([])
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

  it('truncateSessionAfterOrderIndex flushes session JSON when requested', async () => {
    const flushSessionToDisk = vi.fn().mockResolvedValue(undefined)

    await truncateSessionAfterOrderIndex(sessionRepo as any, snapshotRepo as any, 'sess-1', 3, {
      flushSessionToDisk
    })

    expect(flushSessionToDisk).toHaveBeenCalledWith('sess-1')
  })

  it('truncateSessionAfterOrderIndex deletes messages before cleaning attachments', async () => {
    const parts = [{ type: 'image', data: { filePath: '/Attachments/sess-1/a.png' } }]
    sessionRepo.listMessageIdsAfterOrderIndex.mockResolvedValue(['m2', 'm3'])
    sessionRepo.getPartsByMessageIds.mockResolvedValue(parts)
    const cleanupAttachments = vi.fn().mockResolvedValue(undefined)

    await truncateSessionAfterOrderIndex(sessionRepo as any, snapshotRepo as any, 'sess-1', 1, {
      cleanupAttachments
    })

    expect(sessionRepo.listMessageIdsAfterOrderIndex).toHaveBeenCalledWith('sess-1', 1)
    expect(sessionRepo.getPartsByMessageIds).toHaveBeenCalledWith(['m2', 'm3'])
    expect(sessionRepo.deleteMessagesAfter).toHaveBeenCalledWith('sess-1', 1)
    expect(cleanupAttachments).toHaveBeenCalledWith('sess-1', parts)
    const deleteOrder = sessionRepo.deleteMessagesAfter.mock.invocationCallOrder[0]
    const cleanupOrder = cleanupAttachments.mock.invocationCallOrder[0]
    expect(deleteOrder).toBeDefined()
    expect(cleanupOrder).toBeDefined()
    expect(deleteOrder!).toBeLessThan(cleanupOrder!)
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
