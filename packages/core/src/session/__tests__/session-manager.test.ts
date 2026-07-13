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
    mockRepo = {
      upsertSession: vi.fn(),
      upsertAggregate: vi.fn(),
      insertMessageWithParts: vi.fn(),
      updateTokenUsage: vi.fn(),
      togglePin: vi.fn(),
      deleteSessions: vi.fn(),
      findAllSessions: vi.fn(),
      getMessagesBySession: vi.fn(),
      getSessionAggregate: vi.fn()
    } as any

    mockFileService = {
      writeSession: vi.fn(),
      readSession: vi.fn(),
      deleteSession: vi.fn(),
      listAllSessions: vi.fn(),
      listSessionsAcrossVaults: vi.fn(),
      getSessionFileByteSize: vi.fn()
    } as any

    mockSyncService = {
      syncSessionFile: vi.fn(),
      fullScanArchives: vi.fn()
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
    const arg = mockSyncService.fullScanArchives.mock.calls[0]?.[0] as {
      preserveSessionIds?: Set<string>
    }
    expect(arg?.preserveSessionIds?.has('mid-chat')).toBe(true)
  })

  it('ensureSessionsFlushedToDisk() flushes missing sessions across vaults for all assistants', async () => {
    mockRepo.findAllSessions.mockResolvedValue([
      { id: 'a', vaultName: 'Personal85', assistantId: 'default', title: 'A' },
      { id: 'b', vaultName: 'Personal85', assistantId: 'default', title: 'B' },
      { id: 'legacy', vaultName: 'Personal', assistantId: 'legacy_ast_1', title: 'L' }
    ] as any)
    mockFileService.listSessionsAcrossVaults.mockResolvedValue([
      { id: 'a', fullPath: '/Personal85/Sessions/a.json', vaultName: 'Personal85' }
    ])
    mockRepo.getSessionAggregate.mockResolvedValue(aggregateDummy)

    const result = await manager.ensureSessionsFlushedToDisk({
      activeVaultName: 'Personal85',
      diskVaultNames: ['Personal', 'Personal85']
    })

    expect(result.flushed).toBe(2)
    expect(result.pendingFlushed).toBe(false)
    expect(result.skippedMissingScan).toBe(false)
    expect(result.dbTotalCount).toBe(3)
    expect(result.diskCount).toBe(1)
    expect(result.missingIds.sort()).toEqual(['b', 'legacy'])
    expect(mockFileService.writeSession).toHaveBeenCalledWith('b', aggregateDummy, 'Personal85')
    expect(mockFileService.writeSession).toHaveBeenCalledWith('legacy', aggregateDummy, 'Personal')
  })

  it('ensureSessionsFlushedToDisk({ mode: pending-only }) skips missing-session backfill', async () => {
    mockRepo.findAllSessions.mockResolvedValue([
      { id: 'a', vaultName: 'Personal85', assistantId: 'default', title: 'A' }
    ] as any)

    const result = await manager.ensureSessionsFlushedToDisk({
      activeVaultName: 'Personal85',
      diskVaultNames: ['Personal85'],
      mode: 'pending-only'
    })

    expect(result.flushed).toBe(0)
    expect(result.skippedMissingScan).toBe(true)
    expect(mockRepo.findAllSessions).not.toHaveBeenCalled()
    expect(mockFileService.writeSession).not.toHaveBeenCalled()
  })

  it('ensureSessionsFlushedToDisk() skips missing-file backfill without target vault', async () => {
    mockRepo.findAllSessions.mockResolvedValue([{ id: 'a', vaultName: 'Work' }] as any)
    mockFileService.listAllSessions.mockResolvedValue([])
    mockRepo.getSessionAggregate.mockResolvedValue(aggregateDummy)

    const result = await manager.ensureSessionsFlushedToDisk({
      activeVaultName: null,
      diskVaultNames: []
    })

    expect(result.skippedMissingScan).toBe(true)
    expect(result.flushed).toBe(0)
    expect(mockRepo.findAllSessions).not.toHaveBeenCalled()
    expect(mockFileService.writeSession).not.toHaveBeenCalled()
  })

  it('hydrateSessionsFromDiskIfNeeded() upserts only missing unique session ids', async () => {
    mockRepo.findAllSessions
      .mockResolvedValueOnce([{ id: 'only-db', vaultName: 'Work' }] as any)
      .mockResolvedValueOnce([
        { id: 'only-db', vaultName: 'Work' },
        { id: 'from-disk', vaultName: 'Personal' }
      ] as any)
    mockFileService.listSessionsAcrossVaults.mockResolvedValue([
      { id: 'only-db', fullPath: '/Work/Sessions/only-db.json', vaultName: 'Work' },
      { id: 'from-disk', fullPath: '/Personal/Sessions/from-disk.json', vaultName: 'Personal' },
      // 跨 vault 同 id 重复文件，不应再 upsert only-db
      { id: 'only-db', fullPath: '/Personal/Sessions/only-db.json', vaultName: 'Personal' }
    ])
    mockFileService.readSession.mockResolvedValue({
      session: { id: 'from-disk', vaultName: 'Personal' },
      messages: []
    })

    const result = await manager.hydrateSessionsFromDiskIfNeeded({
      activeVaultName: 'Work',
      diskVaultNames: ['Personal', 'Work']
    })

    expect(result.hydrated).toBe(true)
    expect(result.reason).toBe('missing-ids')
    expect(result.missingCount).toBe(1)
    expect(mockFileService.readSession).toHaveBeenCalledTimes(1)
    expect(mockFileService.readSession).toHaveBeenCalledWith('from-disk', 'Personal')
    expect(mockRepo.upsertAggregate).toHaveBeenCalledTimes(1)
    expect(mockSyncService.fullScanArchives).not.toHaveBeenCalled()
  })

  it('hydrateSessionsFromDiskIfNeeded() skips when all unique disk ids already in db', async () => {
    mockRepo.findAllSessions.mockResolvedValue([
      { id: 'a', vaultName: 'Work' },
      { id: 'b', vaultName: 'Personal' }
    ] as any)
    mockFileService.listSessionsAcrossVaults.mockResolvedValue([
      { id: 'a', fullPath: '/Work/Sessions/a.json', vaultName: 'Work' },
      { id: 'b', fullPath: '/Personal/Sessions/b.json', vaultName: 'Personal' },
      { id: 'a', fullPath: '/Personal/Sessions/a.json', vaultName: 'Personal' }
    ])

    const result = await manager.hydrateSessionsFromDiskIfNeeded({
      activeVaultName: 'Work',
      diskVaultNames: ['Personal', 'Work']
    })

    expect(result.hydrated).toBe(false)
    expect(result.reason).toBe('db-caught-up')
    expect(result.missingCount).toBe(0)
    expect(mockFileService.readSession).not.toHaveBeenCalled()
    expect(mockSyncService.fullScanArchives).not.toHaveBeenCalled()
  })
})
