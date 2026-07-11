import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionManagerService } from '../session-manager.service'
import { SessionSyncService } from '../session-sync.service'
import { SessionFileService } from '../session-file.service'
import { SessionRepository } from '@baishou/database'

describe('SessionManagerService (Ghost memory interceptor)', () => {
  let mockFileService: import('vitest').Mocked<SessionFileService>
  let mockSyncService: import('vitest').Mocked<SessionSyncService>
  let mockRepo: import('vitest').Mocked<SessionRepository>
  let manager: SessionManagerService

  beforeEach(() => {
    mockFileService = {
      writeSession: vi.fn(),
      readSession: vi.fn(),
      deleteSession: vi.fn(),
      listAllSessions: vi.fn()
    } as any

    mockSyncService = {
      syncSessionFile: vi.fn(),
      fullScanArchives: vi.fn()
    } as any

    mockRepo = {
      upsertSession: vi.fn(),
      insertMessageWithParts: vi.fn(),
      updateTokenUsage: vi.fn(),
      togglePin: vi.fn(),
      deleteSessions: vi.fn(),
      findAllSessions: vi.fn(),
      getMessagesBySession: vi.fn(),
      getSessionAggregate: vi.fn()
    } as any

    manager = new SessionManagerService(mockRepo, mockFileService, mockSyncService)
  })

  const aggregateDummy = { session: { id: 'chat-1' }, messages: [] }

  it('upsertSession() should write to SQLite first, then flush aggregate to disk', async () => {
    mockRepo.getSessionAggregate.mockResolvedValue(aggregateDummy)

    await manager.upsertSession({
      id: 'chat-1',
      vaultName: 'test',
      providerId: 'p',
      modelId: 'm'
    })

    expect(mockRepo.upsertSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'chat-1' }))
    expect(mockRepo.getSessionAggregate).toHaveBeenCalledWith('chat-1')
    expect(mockFileService.writeSession).toHaveBeenCalledWith('chat-1', aggregateDummy)
  })

  it('insertMessageWithParts() should write to SQLite and schedule debounced disk flush', async () => {
    vi.useFakeTimers()
    mockRepo.getSessionAggregate.mockResolvedValue(aggregateDummy)

    await manager.insertMessageWithParts(
      { id: 'msg-1', sessionId: 'chat-1', role: 'user', orderIndex: 0 },
      []
    )

    expect(mockRepo.insertMessageWithParts).toHaveBeenCalled()
    expect(mockFileService.writeSession).not.toHaveBeenCalled()

    await vi.runAllTimersAsync()
    expect(mockFileService.writeSession).toHaveBeenCalledWith('chat-1', aggregateDummy)
    vi.useRealTimers()
  })

  it('deleteSessions() should purge both SQLite and physical JSON files', async () => {
    await manager.deleteSessions(['chat-1', 'chat-2'])

    expect(mockRepo.deleteSessions).toHaveBeenCalledWith(['chat-1', 'chat-2'])
    expect(mockFileService.deleteSession).toHaveBeenCalledWith('chat-1')
    expect(mockFileService.deleteSession).toHaveBeenCalledWith('chat-2')
  })

  it('fullResyncFromDisks() flushes pending then calls fullScanArchives', async () => {
    await manager.fullResyncFromDisks({ activeVaultName: 'Work' })
    expect(mockSyncService.fullScanArchives).toHaveBeenCalledWith(
      expect.objectContaining({ activeVaultName: 'Work' })
    )
  })

  it('fullResyncFromDisks() preserves sessions that remain dirty after flush', async () => {
    mockRepo.getSessionAggregate.mockResolvedValue(aggregateDummy)
    mockFileService.writeSession.mockRejectedValue(new Error('disk busy'))
    manager.notifySessionMutated('mid-chat', 'debounced')

    await manager.fullResyncFromDisks({ activeVaultName: 'Work' })

    expect(mockSyncService.fullScanArchives).toHaveBeenCalledWith(
      expect.objectContaining({
        activeVaultName: 'Work',
        preserveSessionIds: expect.any(Set)
      })
    )
    const arg = mockSyncService.fullScanArchives.mock.calls[0][0] as {
      preserveSessionIds?: Set<string>
    }
    expect(arg.preserveSessionIds?.has('mid-chat')).toBe(true)
  })
})
