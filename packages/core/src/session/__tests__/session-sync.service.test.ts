import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionSyncService } from '../session-sync.service'
import type { SessionFileService } from '../session-file.service'
import type { SessionRepository } from '@baishou/database'

describe('SessionSyncService', () => {
  let mockFileService: import('vitest').Mocked<SessionFileService>
  let mockRepo: import('vitest').Mocked<SessionRepository>
  let service: SessionSyncService

  beforeEach(() => {
    mockFileService = {
      listAllSessions: vi.fn().mockResolvedValue([]),
      readSession: vi.fn(),
      getSessionFileByteSize: vi.fn(),
      writeSession: vi.fn(),
      deleteSession: vi.fn()
    } as any

    mockRepo = {
      findAllSessions: vi.fn().mockResolvedValue([]),
      upsertAggregate: vi.fn(),
      deleteSessions: vi.fn()
    } as any

    service = new SessionSyncService(mockRepo, mockFileService)
  })

  it('fullScanArchives deletes active-vault ghosts without disk files', async () => {
    mockFileService.listAllSessions.mockResolvedValue([])
    mockRepo.findAllSessions.mockResolvedValue([
      { id: 'gone', vaultName: 'Work' },
      { id: 'other', vaultName: 'Personal' }
    ] as any)

    await service.fullScanArchives({ activeVaultName: 'Work' })

    expect(mockRepo.deleteSessions).toHaveBeenCalledWith(['gone'])
  })

  it('fullScanArchives preserves dirty / unflushed session ids', async () => {
    mockFileService.listAllSessions.mockResolvedValue([])
    mockRepo.findAllSessions.mockResolvedValue([
      { id: 'mid-chat', vaultName: 'Work' },
      { id: 'stale', vaultName: 'Work' }
    ] as any)

    await service.fullScanArchives({
      activeVaultName: 'Work',
      preserveSessionIds: ['mid-chat']
    })

    expect(mockRepo.deleteSessions).toHaveBeenCalledWith(['stale'])
  })

  it('fullScanArchives skips other vaults even without preserve list', async () => {
    mockFileService.listAllSessions.mockResolvedValue([{ id: 'a' }] as any)
    mockFileService.readSession.mockResolvedValue({ session: { id: 'a' }, messages: [] } as any)
    mockRepo.findAllSessions.mockResolvedValue([
      { id: 'a', vaultName: 'Work' },
      { id: 'b', vaultName: 'Personal' }
    ] as any)

    await service.fullScanArchives({ activeVaultName: 'Work' })

    expect(mockRepo.deleteSessions).not.toHaveBeenCalled()
  })

  it('fullScanArchives hydrates sessions across all disk vaults', async () => {
    mockFileService.listSessionsAcrossVaults = vi.fn().mockResolvedValue([
      {
        id: 'from-personal',
        fullPath: '/Personal/Sessions/from-personal.json',
        vaultName: 'Personal'
      },
      { id: 'from-work', fullPath: '/Work/Sessions/from-work.json', vaultName: 'Work' }
    ])
    mockFileService.readSession.mockImplementation(
      async (id: string, vaultName?: string | null) => ({
        session: { id, vaultName },
        messages: []
      })
    )
    mockRepo.findAllSessions.mockResolvedValue([{ id: 'from-work', vaultName: 'Work' }] as any)

    await service.fullScanArchives({
      activeVaultName: 'Work',
      diskVaultNames: ['Personal', 'Work']
    })

    expect(mockFileService.listSessionsAcrossVaults).toHaveBeenCalledWith(['Personal', 'Work'])
    expect(mockFileService.readSession).toHaveBeenCalledWith('from-personal', 'Personal')
    expect(mockFileService.readSession).toHaveBeenCalledWith('from-work', 'Work')
    expect(mockRepo.upsertAggregate).toHaveBeenCalledTimes(2)
    expect(mockRepo.deleteSessions).not.toHaveBeenCalled()
  })

  it('fullScanArchives deletes ghosts only within scanned vaults', async () => {
    mockFileService.listSessionsAcrossVaults = vi
      .fn()
      .mockResolvedValue([{ id: 'kept', fullPath: '/Work/Sessions/kept.json', vaultName: 'Work' }])
    mockFileService.readSession.mockResolvedValue({ session: { id: 'kept' }, messages: [] } as any)
    mockRepo.findAllSessions.mockResolvedValue([
      { id: 'kept', vaultName: 'Work' },
      { id: 'ghost-work', vaultName: 'Work' },
      { id: 'other-vault', vaultName: 'Archive' }
    ] as any)

    await service.fullScanArchives({
      activeVaultName: 'Work',
      diskVaultNames: ['Personal', 'Work']
    })

    expect(mockRepo.deleteSessions).toHaveBeenCalledWith(['ghost-work'])
  })
})
