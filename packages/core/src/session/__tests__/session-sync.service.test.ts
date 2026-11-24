import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SessionSyncService } from '../session-sync.service'
import type { SessionFileService } from '../session-file.service'
import type { SessionRepository } from '@baishou/database'
import { deriveLegacyVaultId } from '@baishou/shared'

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
      findAllSessionsAcrossVaults: vi.fn().mockResolvedValue([]),
      upsertAggregate: vi.fn(),
      deleteSessions: vi.fn()
    } as any

    service = new SessionSyncService(mockRepo, mockFileService)
  })

  it('fullScanArchives skips ghost cleanup when the scan finds no session files', async () => {
    mockFileService.listAllSessions.mockResolvedValue([])
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
      { id: 'gone', vaultName: 'Work' },
      { id: 'other', vaultName: 'Personal' }
    ] as any)

    await service.fullScanArchives({ activeVaultName: 'Work' })

    expect(mockRepo.deleteSessions).not.toHaveBeenCalled()
  })

  it('fullScanArchives still deletes ghosts when at least one session file was found', async () => {
    mockFileService.listAllSessions.mockResolvedValue([{ id: 'kept' }] as any)
    mockFileService.readSession.mockResolvedValue({ session: { id: 'kept' }, messages: [] } as any)
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
      { id: 'kept', vaultName: 'Work' },
      { id: 'gone', vaultName: 'Work' },
      { id: 'other', vaultName: 'Personal' }
    ] as any)

    await service.fullScanArchives({ activeVaultName: 'Work' })

    expect(mockRepo.deleteSessions).toHaveBeenCalledWith(['gone'])
  })

  it('fullScanArchives preserves dirty / unflushed session ids', async () => {
    mockFileService.listAllSessions.mockResolvedValue([{ id: 'kept' }] as any)
    mockFileService.readSession.mockResolvedValue({ session: { id: 'kept' }, messages: [] } as any)
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
      { id: 'kept', vaultName: 'Work' },
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
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
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
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
      { id: 'from-work', vaultName: 'Work' }
    ] as any)

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
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
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

  it('fullScanArchives preserves a scanned vault that yielded no session files', async () => {
    mockFileService.listSessionsAcrossVaults = vi.fn().mockResolvedValue([
      {
        id: 'kept-personal',
        fullPath: '/Personal/Sessions/kept.json',
        vaultName: 'Personal'
      }
    ])
    mockFileService.readSession.mockResolvedValue({
      session: { id: 'kept-personal' },
      messages: []
    } as any)
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
      { id: 'kept-personal', vaultName: 'Personal' },
      { id: 'ghost-personal', vaultName: 'Personal' },
      { id: 'ghost-work', vaultName: 'Work' }
    ] as any)

    await service.fullScanArchives({
      activeVaultName: 'Personal',
      diskVaultNames: ['Personal', 'Work']
    })

    expect(mockRepo.deleteSessions).toHaveBeenCalledWith(['ghost-personal'])
    expect(mockRepo.deleteSessions).not.toHaveBeenCalledWith(['ghost-work'])
  })

  it('fullScanArchives resolves vaultId-only rows against scanned vault ids', async () => {
    const workId = deriveLegacyVaultId('Work')
    mockFileService.listSessionsAcrossVaults = vi
      .fn()
      .mockResolvedValue([{ id: 'kept', fullPath: '/Work/Sessions/kept.json', vaultName: 'Work' }])
    mockFileService.readSession.mockResolvedValue({ session: { id: 'kept' }, messages: [] } as any)
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
      { id: 'ghost-work', vaultId: workId },
      { id: 'other-vault', vaultId: 'vlt_other_vault' }
    ] as any)

    await service.fullScanArchives({
      activeVaultName: 'Work',
      activeVaultId: workId,
      diskVaultNames: ['Work'],
      vaultIdByName: { Work: workId }
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
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
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

  it('reconcileFromDisks and fullScanArchives request low-priority repo view when available', async () => {
    const lowRepo = {
      findAllSessionsAcrossVaults: vi.fn().mockResolvedValue([]),
      upsertAggregate: vi.fn().mockResolvedValue(undefined),
      deleteSessions: vi.fn().mockResolvedValue(undefined)
    }
    const withLockPriority = vi.fn().mockReturnValue(lowRepo)
    const prioritizedRepo = {
      ...mockRepo,
      withLockPriority
    } as any
    const prioritizedService = new SessionSyncService(prioritizedRepo, mockFileService)

    mockFileService.listAllSessions.mockResolvedValue([{ id: 's-bg' }] as any)
    mockFileService.readSession.mockResolvedValue({ session: { id: 's-bg' }, messages: [] } as any)

    await prioritizedService.reconcileFromDisks({ activeVaultName: 'Personal' })
    await prioritizedService.fullScanArchives({ activeVaultName: 'Personal' })
    await prioritizedService.syncSessionFile('s-bg', 'Personal')

    expect(withLockPriority).toHaveBeenCalledWith('low')
    expect(lowRepo.upsertAggregate).toHaveBeenCalledTimes(3)
    expect(mockRepo.upsertAggregate).not.toHaveBeenCalled()
  })

  it('reconcileFromDisks prioritizes active vault and newest mtimeMs first using single stat', async () => {
    const getSessionFileStat = vi.fn(async (id: string) => {
      const map: Record<string, { size: number; mtimeMs: number }> = {
        'other-newest': { size: 100, mtimeMs: 9_000 },
        'other-older': { size: 100, mtimeMs: 2_000 },
        'active-older': { size: 100, mtimeMs: 3_000 },
        'active-newest': { size: 100, mtimeMs: 8_000 },
        'active-oversized': { size: 5_000, mtimeMs: 10_000 }
      }
      return map[id]
    })
    ;(mockFileService as any).getSessionFileStat = getSessionFileStat
    mockFileService.listSessionsAcrossVaults.mockResolvedValue([
      { id: 'other-older', fullPath: '/Other/Sessions/other-older.json', vaultName: 'Other' },
      { id: 'other-newest', fullPath: '/Other/Sessions/other-newest.json', vaultName: 'Other' },
      { id: 'active-older', fullPath: '/Work/Sessions/active-older.json', vaultName: 'Work' },
      { id: 'active-newest', fullPath: '/Work/Sessions/active-newest.json', vaultName: 'Work' },
      {
        id: 'active-oversized',
        fullPath: '/Work/Sessions/active-oversized.json',
        vaultName: 'Work'
      }
    ])
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([])
    mockFileService.readSession.mockImplementation(async (id: string) => ({
      session: { id },
      messages: []
    }))

    const importedOrder: string[] = []
    const callbackEvents: Array<{ sessionId: string; importedCount: number }> = []
    mockRepo.upsertAggregate.mockImplementation(async (data: any) => {
      importedOrder.push(data.session.id)
    })

    await service.reconcileFromDisks({
      activeVaultName: 'Work',
      diskVaultNames: ['Other', 'Work'],
      maxSessionJsonReadBytes: 1_000,
      onSessionImported: (info) =>
        callbackEvents.push({ sessionId: info.sessionId, importedCount: info.importedCount })
    })

    expect(importedOrder).toEqual(['active-newest', 'active-older', 'other-newest', 'other-older'])
    expect(callbackEvents).toEqual([
      { sessionId: 'active-newest', importedCount: 1 },
      { sessionId: 'active-older', importedCount: 2 },
      { sessionId: 'other-newest', importedCount: 3 },
      { sessionId: 'other-older', importedCount: 4 }
    ])
    expect(getSessionFileStat).toHaveBeenCalledTimes(5)
    expect(mockFileService.getSessionFileByteSize).not.toHaveBeenCalled()
    expect(mockFileService.getSessionFileMtimeMs).not.toHaveBeenCalled()
  })

  it('reconcileFromDisks and fullScanArchives prevent non-canonical alias files from overwriting canonical sessions', async () => {
    const dbUpdatedAt = new Date('2026-07-01T12:00:00.000Z')
    ;(mockFileService as any).getSessionFileStat = vi.fn(async (id: string) => {
      if (id === 's1') return { size: 200, mtimeMs: dbUpdatedAt.getTime() }
      // 模拟同步冲突副本具有更新的磁盘 mtime，但内部 session.id 仍指向 s1
      if (id === 's1 (conflict)') return { size: 150, mtimeMs: dbUpdatedAt.getTime() + 60_000 }
      return undefined
    })
    mockFileService.listSessionsAcrossVaults.mockResolvedValue([
      { id: 's1', fullPath: '/Work/Sessions/s1.json', vaultName: 'Work' },
      { id: 's1 (conflict)', fullPath: '/Work/Sessions/s1 (conflict).json', vaultName: 'Work' }
    ])
    mockRepo.findAllSessionsAcrossVaults.mockResolvedValue([
      { id: 's1', vaultName: 'Work', updatedAt: dbUpdatedAt }
    ] as any)
    mockFileService.readSession.mockImplementation(async (id: string) => ({
      session: { id: 's1', title: id === 's1' ? 'Canonical' : 'Stale Conflict' },
      messages: []
    }))

    await service.reconcileFromDisks({
      activeVaultName: 'Work',
      diskVaultNames: ['Work']
    })
    expect(mockRepo.upsertAggregate).not.toHaveBeenCalled()

    await service.fullScanArchives({
      activeVaultName: 'Work',
      diskVaultNames: ['Work']
    })
    expect(mockRepo.upsertAggregate).toHaveBeenCalledTimes(1)
    expect(mockRepo.upsertAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({ id: 's1', title: 'Canonical' })
      })
    )
  })
})
