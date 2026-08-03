import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deriveLegacyVaultId } from '@baishou/shared'
import { SummarySyncService } from '../summary-sync.service'
import { SummaryFileService } from '../../vault/summary-file.service'
import { SummaryRepository } from '@baishou/database'
import { SummaryType } from '@baishou/shared'
import { MissingSummaryDetector } from '../missing-summary-detector.service'
import { SummaryGeneratorService } from '../summary-generator.service'

const VAULT_MAIN = deriveLegacyVaultId('MainVault')
const VAULT_EMPTY = deriveLegacyVaultId('EmptyVault')

describe('SummarySyncService (Ghost indexing)', () => {
  let mockFileService: import('vitest').Mocked<SummaryFileService>
  let mockRepo: import('vitest').Mocked<SummaryRepository>
  let mockDetector: import('vitest').Mocked<MissingSummaryDetector>
  let mockGenerator: import('vitest').Mocked<SummaryGeneratorService>
  let service: SummarySyncService

  beforeEach(() => {
    mockFileService = {
      readSummary: vi.fn(),
      readSummaryAtAbsolutePath: vi.fn(),
      listAllSummaries: vi.fn(),
      listSummariesAcrossVaults: vi.fn(),
      getSummaryFileMtimeMs: vi.fn()
    } as any

    mockRepo = {
      getByDateRange: vi.fn(),
      findAllByTypeAndStartDay: vi.fn().mockResolvedValue([]),
      getSummaries: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      update: vi.fn()
    } as any

    mockDetector = {
      getAllMissing: vi.fn()
    } as any

    mockGenerator = {
      generate: vi.fn()
    } as any

    service = new SummarySyncService(
      mockDetector,
      mockGenerator,
      mockRepo,
      mockFileService,
      () => VAULT_MAIN
    )
  })

  const type = SummaryType.monthly
  const start = new Date()
  const end = new Date()

  it('syncSummaryFile() should delete if file goes missing (Ghost cleanup)', async () => {
    mockFileService.readSummary.mockResolvedValue(null)
    mockRepo.getByDateRange.mockResolvedValue({
      id: 88,
      content: 'old'
    } as any)
    mockRepo.findAllByTypeAndStartDay.mockResolvedValue([{ id: 88, content: 'old' } as any])

    await service.syncSummaryFile(type, start, end)

    expect(mockRepo.delete).toHaveBeenCalledWith(88)
    expect(mockRepo.upsert).not.toHaveBeenCalled()
  })

  it('syncSummaryFile() should delete ghost when endDate only mismatches (UI midnight vs 23:59:59)', async () => {
    const weekStart = new Date(2026, 2, 23)
    const weekEndUi = new Date(2026, 2, 29)
    const weekEndDb = new Date(2026, 2, 29, 23, 59, 59)

    mockFileService.readSummary.mockResolvedValue(null)
    mockRepo.getByDateRange.mockResolvedValue(null)
    mockRepo.findAllByTypeAndStartDay.mockResolvedValue([
      {
        id: 13,
        type: SummaryType.weekly,
        startDate: weekStart,
        endDate: weekEndDb,
        content: 'week 13'
      } as any
    ])

    await service.syncSummaryFile(SummaryType.weekly, weekStart, weekEndUi)

    expect(mockRepo.findAllByTypeAndStartDay).toHaveBeenCalledWith(
      SummaryType.weekly,
      weekStart,
      VAULT_MAIN
    )
    expect(mockRepo.delete).toHaveBeenCalledWith(13)
    expect(mockRepo.upsert).not.toHaveBeenCalled()
  })

  it('syncSummaryFile() should upsert if DB is empty or outdated', async () => {
    mockFileService.readSummary.mockResolvedValue('Fresh New File')
    mockRepo.findAllByTypeAndStartDay.mockResolvedValue([])

    mockRepo.getByDateRange.mockResolvedValueOnce(null)
    await service.syncSummaryFile(type, start, end)
    expect(mockRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'Fresh New File', vaultId: VAULT_MAIN })
    )

    mockRepo.getByDateRange.mockResolvedValueOnce({
      id: 1,
      content: 'Stale DB',
      endDate: end
    } as any)
    await service.syncSummaryFile(type, start, end)
    expect(mockRepo.update).toHaveBeenCalledWith(1, { content: 'Fresh New File' })
  })

  it('fullScanArchives() should prune DB ghosts and upsert existing files during active vault resync', async () => {
    const t2 = new Date()
    mockFileService.listAllSummaries.mockResolvedValue([
      {
        type: SummaryType.monthly,
        startDate: start,
        endDate: end,
        fullPath: '/a.md'
      }
    ])
    mockFileService.readSummaryAtAbsolutePath.mockResolvedValue('content_xyz')

    mockRepo.getSummaries.mockResolvedValue([
      { id: 99, type: SummaryType.monthly, startDate: t2, content: '' } as any
    ])

    mockRepo.getByDateRange.mockResolvedValue(null)

    await service.fullScanArchives({
      activeVaultName: 'MainVault',
      activeVaultId: VAULT_MAIN
    })

    expect(mockRepo.delete).toHaveBeenCalledWith(99)
    expect(mockRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'content_xyz', vaultId: VAULT_MAIN })
    )
  })

  it('fullScanArchives() should skip ghost cleanup when disk scan is empty but DB has records', async () => {
    mockFileService.listAllSummaries.mockResolvedValue([])
    mockRepo.getSummaries.mockResolvedValue([
      { id: 42, type: SummaryType.weekly, startDate: start, content: 'restored' } as any
    ])

    await service.fullScanArchives()

    expect(mockRepo.delete).not.toHaveBeenCalled()
    expect(mockRepo.upsert).not.toHaveBeenCalled()
  })

  it('fullScanArchives() should clear cache for active vault when disk scan is empty', async () => {
    mockFileService.listAllSummaries.mockResolvedValue([])
    mockRepo.getSummaries.mockResolvedValue([
      { id: 42, type: SummaryType.weekly, startDate: start, content: 'old-vault' } as any
    ])

    await service.fullScanArchives({
      activeVaultName: 'EmptyVault',
      activeVaultId: VAULT_EMPTY
    })

    expect(mockRepo.getSummaries).toHaveBeenCalledWith({ vaultId: VAULT_EMPTY })
    expect(mockRepo.delete).toHaveBeenCalledWith(42)
    expect(mockRepo.upsert).not.toHaveBeenCalled()
  })

  it('syncSummaryFile() skips read when skipUnchangedByMtime and disk mtime is not newer', async () => {
    const dbUpdatedAt = new Date('2026-07-01T12:00:00.000Z')
    mockRepo.getByDateRange.mockResolvedValue({
      id: 7,
      content: 'cached',
      endDate: end,
      updatedAt: dbUpdatedAt,
      generatedAt: dbUpdatedAt
    } as any)
    mockFileService.getSummaryFileMtimeMs.mockResolvedValue(dbUpdatedAt.getTime())

    await service.syncSummaryFile(type, start, end, {
      skipUnchangedByMtime: true,
      diskPath: '/Summaries/Monthly/2026-07-01.md'
    })

    expect(mockFileService.getSummaryFileMtimeMs).toHaveBeenCalledWith(
      type,
      start,
      '/Summaries/Monthly/2026-07-01.md'
    )
    expect(mockFileService.readSummary).not.toHaveBeenCalled()
    expect(mockFileService.readSummaryAtAbsolutePath).not.toHaveBeenCalled()
    expect(mockRepo.upsert).not.toHaveBeenCalled()
    expect(mockRepo.update).not.toHaveBeenCalled()
  })

  it('fullScanArchives({ skipUnchangedByMtime }) still reads when disk mtime is newer', async () => {
    const dbUpdatedAt = new Date('2026-07-01T12:00:00.000Z')
    mockFileService.listAllSummaries.mockResolvedValue([
      {
        type: SummaryType.monthly,
        startDate: start,
        endDate: end,
        fullPath: '/a.md'
      }
    ])
    mockRepo.getByDateRange.mockResolvedValue({
      id: 1,
      content: 'Stale DB',
      endDate: end,
      updatedAt: dbUpdatedAt,
      generatedAt: dbUpdatedAt
    } as any)
    mockFileService.getSummaryFileMtimeMs.mockResolvedValue(dbUpdatedAt.getTime() + 10_000)
    mockFileService.readSummaryAtAbsolutePath.mockResolvedValue('Fresh New File')
    mockRepo.getSummaries.mockResolvedValue([])

    await service.fullScanArchives({
      activeVaultName: 'MainVault',
      activeVaultId: VAULT_MAIN,
      skipUnchangedByMtime: true
    })

    expect(mockFileService.readSummaryAtAbsolutePath).toHaveBeenCalled()
    expect(mockRepo.update).toHaveBeenCalledWith(1, { content: 'Fresh New File' })
  })
})
