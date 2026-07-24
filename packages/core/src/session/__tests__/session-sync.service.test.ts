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
      listSessionsAcrossVaults: vi.fn().mockResolvedValue([]),
      readSession: vi.fn(),
      getSessionFileByteSize: vi.fn(),
      getSessionFileMtimeMs: vi.fn(),
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

  it('reconcileFromDisks skips read when disk mtime is not newer than DB updatedAt', async () => {
    const dbUpdatedAt = new Date('2026-07-01T12:00:00.000Z')
    mockFileService.listSessionsAcrossVaults.mockResolvedValue([
      { id: 'unchanged', fullPath: '/Work/Sessions/unchanged.json', vaultName: 'Work' },
      { id: 'newer', fullPath: '/Work/Sessions/newer.json', vaultName: 'Work' },
      { id: 'missing', fullPath: '/Work/Sessions/missing.json', vaultName: 'Work' }
    ])
    mockRepo.findAllSessions.mockResolvedValue([
      { id: 'unchanged', vaultName: 'Work', updatedAt: dbUpdatedAt },
      { id: 'newer', vaultName: 'Work', updatedAt: dbUpdatedAt },
      { id: 'ghost', vaultName: 'Work', updatedAt: dbUpdatedAt }
    ] as any)
    mockFileService.getSessionFileMtimeMs.mockImplementation(async (id: string) => {
      if (id === 'unchanged') return dbUpdatedAt.getTime()
      if (id === 'newer') return dbUpdatedAt.getTime() + 5_000
      return undefined
    })
    mockFileService.readSession.mockImplementation(async (id: string) => ({
      session: { id },
      messages: []
    }))

    await service.reconcileFromDisks({
      activeVaultName: 'Work',
      diskVaultNames: ['Work']
    })

    expect(mockFileService.readSession).not.toHaveBeenCalledWith('unchanged', 'Work')
    expect(mockFileService.readSession).toHaveBeenCalledWith('newer', 'Work')
    expect(mockFileService.readSession).toHaveBeenCalledWith('missing', 'Work')
    expect(mockRepo.upsertAggregate).toHaveBeenCalledTimes(2)
    expect(mockRepo.deleteSessions).toHaveBeenCalledWith(['ghost'])
  })
})
