import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SummaryManagerService } from '../summary-manager.service'
import { SummarySyncService } from '../summary-sync.service'
import { SummaryFileService } from '../../vault/summary-file.service'
import { SummaryRepository } from '@baishou/database'
import { SummaryType, Summary } from '@baishou/shared'

describe('SummaryManagerService (SSOT refactor)', () => {
  let mockFileService: import('vitest').Mocked<SummaryFileService>
  let mockSyncService: import('vitest').Mocked<SummarySyncService>
  let mockRepo: import('vitest').Mocked<SummaryRepository>
  let manager: SummaryManagerService

  beforeEach(() => {
    mockFileService = {
      writeSummary: vi.fn(),
      readSummary: vi.fn(),
      deleteSummary: vi.fn(),
      listAllSummaries: vi.fn(),
      parseFileNameToDateRange: vi.fn()
    } as any

    mockSyncService = {
      syncMissingSummaries: vi.fn(),
      syncSummaryFile: vi.fn(),
      fullScanArchives: vi.fn(),
      isCurrentlySyncing: vi.fn()
    } as any

    mockRepo = {
      save: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      getByDateRange: vi.fn(),
      getSummaries: vi.fn(),
      countByType: vi.fn(),
      delete: vi.fn(),
      deleteAll: vi.fn()
    }

    manager = new SummaryManagerService(mockRepo, mockFileService, mockSyncService)
  })

  const testType = SummaryType.monthly
  const start = new Date('2026-03-01T00:00:00Z')
  const end = new Date('2026-03-31T23:59:59Z')

  it('save() should pipe data correctly to file and then sync', async () => {
    // 假设 sync 后库里有了数据
    mockRepo.getByDateRange.mockResolvedValue({
      id: 99,
      type: testType,
      startDate: start,
      endDate: end,
      content: 'Mock Content',
      generatedAt: new Date()
    } as Summary)

    const result = await manager.save({
      type: testType,
      startDate: start,
      endDate: end,
      content: 'Hello World'
    })

    // 真相单向流：1.先写文件 2.更新索引 3.重读库最新态返回
    expect(mockFileService.writeSummary).toHaveBeenCalledWith(testType, start, 'Hello World')
    expect(mockSyncService.syncSummaryFile).toHaveBeenCalledWith(testType, start, end)
    expect(mockRepo.getByDateRange).toHaveBeenCalledWith(testType, start, end)
    expect(result.id).toBe(99)
  })

  it('readDetail() should prefer file content over db string', async () => {
    mockFileService.readSummary.mockResolvedValue('Fresh from file')
    mockRepo.getByDateRange.mockResolvedValue({
      id: 10,
      content: 'Old DB Content'
    } as any)

    const detail = await manager.readDetail(testType, start, end)

    // 应该穿透 DB 这个只用作列表或搜索缓存的媒介，拿到真实文件里的数据
    expect(mockFileService.readSummary).toHaveBeenCalledWith(testType, start)
    expect(detail?.content).toBe('Fresh from file')
    expect(detail?.id).toBe(10)
  })

  it('readDetail() should return fallback 0-id Summary if DB misses but File exists', async () => {
    mockFileService.readSummary.mockResolvedValue('Unsynced Ghost File Content')
    mockRepo.getByDateRange.mockResolvedValue(null)

    const detail = await manager.readDetail(testType, start, end)

    expect(detail?.id).toBe(0) // 游离态
    expect(detail?.content).toBe('Unsynced Ghost File Content')
  })

  it('list() should read summaries from active vault files', async () => {
    mockFileService.listAllSummaries.mockResolvedValue([
      {
        type: testType,
        startDate: start,
        endDate: end,
        fullPath: '/vault/Archives/Monthly/2026-03-01.md'
      }
    ])
    mockFileService.readSummary.mockResolvedValue('From disk')
    mockRepo.getByDateRange.mockResolvedValue({
      id: 1,
      type: testType,
      startDate: start,
      endDate: end,
      content: 'From disk',
      generatedAt: new Date()
    } as Summary)

    const res = await manager.list()

    expect(mockFileService.listAllSummaries).toHaveBeenCalled()
    expect(mockRepo.getSummaries).not.toHaveBeenCalled()
    expect(res).toHaveLength(1)
    expect(res[0]?.content).toBe('From disk')
  })

  it('list() should hide stale DB summaries when current vault has no summary files', async () => {
    mockRepo.getSummaries.mockResolvedValue([{ id: 1, type: testType, startDate: start }] as any)
    mockFileService.listAllSummaries.mockResolvedValue([])

    const res = await manager.list()

    expect(res).toEqual([])
    expect(mockRepo.getSummaries).not.toHaveBeenCalled()
  })

  it('update() should replace file then trigger DB re-upsert via sync', async () => {
    mockRepo.getByDateRange.mockResolvedValue({ id: 5, content: 'old' } as any)

    await manager.update(5, testType, start, end, { content: 'NewContent' })

    expect(mockFileService.writeSummary).toHaveBeenCalledWith(testType, start, 'NewContent')
    expect(mockSyncService.syncSummaryFile).toHaveBeenCalledWith(testType, start, end)
  })
})
