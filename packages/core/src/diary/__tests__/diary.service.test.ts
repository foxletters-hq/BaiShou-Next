import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DiaryService } from '../diary.service'
import { FileSyncService } from '../file-sync.service'
import { VaultIndexService } from '../vault-index.service'
import { ShadowIndexSyncService } from '../../shadow-index/shadow-index-sync.service'
import { ShadowIndexRepository } from '@baishou/database'
import { DiaryDateConflictError } from '../diary.types'
import { Diary, parseDateStr, formatLocalDate } from '@baishou/shared'

describe('DiaryService - Single Source of Truth architecture', () => {
  let mockShadowRepo: import('vitest').Mocked<ShadowIndexRepository>
  let mockFileSync: import('vitest').Mocked<FileSyncService>
  let mockShadowSync: import('vitest').Mocked<ShadowIndexSyncService>
  let mockVaultIndex: import('vitest').Mocked<VaultIndexService>
  let service: DiaryService

  beforeEach(() => {
    mockShadowRepo = {
      mountFTS: vi.fn(),
      upsert: vi.fn(),
      deleteById: vi.fn(),
      findByDatePrefix: vi.fn(),
      getHashByDate: vi.fn(),
      getAllRecords: vi.fn(),
      searchFTS: vi.fn().mockResolvedValue([]),
      findById: vi.fn(),
      findByDate: vi.fn(),
      listAll: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0)
    } as any

    mockFileSync = {
      writeJournal: vi.fn(),
      readJournal: vi.fn(),
      deleteJournalFile: vi.fn(),
      fullScanVault: vi.fn()
    }

    mockShadowSync = {
      setSyncEnabled: vi.fn(),
      waitForScan: vi.fn(),
      onSyncEvent: vi.fn(),
      syncJournal: vi.fn(),
      fullScanVault: vi.fn()
    } as any

    mockVaultIndex = {
      upsert: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      forceReload: vi.fn(),
      getAll: vi.fn()
    }

    service = new DiaryService(mockShadowRepo, mockFileSync, mockShadowSync, mockVaultIndex)
  })

  it('create() should write file then sync to shadow DB', async () => {
    const inputDate = parseDateStr('2026-03-31')
    const input = { date: inputDate, content: 'Test body', isFavorite: false }

    // 假设物理文件不存在
    mockFileSync.readJournal.mockResolvedValue(null)

    // 假设影子同步结果
    const mockSyncResult = {
      isChanged: true,
      meta: {
        id: 42,
        date: inputDate,
        preview: 'Test body',
        tags: [],
        updatedAt: inputDate
      }
    }
    mockShadowSync.syncJournal.mockResolvedValue(mockSyncResult)

    const result = await service.create(input)

    expect(mockFileSync.readJournal).toHaveBeenCalledWith(inputDate)
    // 确保写入物理文件在前
    expect(mockFileSync.writeJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Test body',
        isFavorite: false
      })
    )
    // 确保触发同步在后
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith('2026-03-31')
    // 确保把同步的结果推给内存库
    expect(mockVaultIndex.upsert).toHaveBeenCalledWith(mockSyncResult.meta)

    // 最终业务层返回 ID 会被补上
    expect(result.id).toBe(42)
  })

  it('create() should throw if file already exists', async () => {
    const inputDate = new Date('2026-03-31')
    const input = { date: inputDate, content: 'Test' }

    // 文件已存在
    mockFileSync.readJournal.mockResolvedValue({
      id: 1,
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
      isFavorite: false,
      mediaPaths: []
    })

    await expect(service.create(input)).rejects.toThrow(DiaryDateConflictError)
    expect(mockFileSync.writeJournal).not.toHaveBeenCalled()
    expect(mockShadowSync.syncJournal).not.toHaveBeenCalled()
  })

  it('update() should replace file and trigger shadow re-sync', async () => {
    const existingDateIso = '2026-03-30T00:00:00.000Z'
    const existingDate = new Date(existingDateIso)

    mockShadowRepo.findById.mockResolvedValue({
      id: 99,
      date: existingDateIso.split('T')[0]!,
      filePath: '2026/03/2026-03-30.md',
      contentHash: 'hash',
      createdAt: '',
      updatedAt: '',
      isFavorite: false,
      hasMedia: false,
      weather: null,
      mood: null,
      location: null,
      locationDetail: null,
      vaultName: 'TestVault'
    })

    const existingDiary: Diary = {
      id: 99,
      date: existingDate,
      content: 'Old',
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      mediaPaths: []
    }
    mockFileSync.readJournal.mockResolvedValue(existingDiary)
    mockShadowSync.syncJournal.mockResolvedValue({
      isChanged: true,
      meta: {
        id: 99,
        date: existingDate,
        preview: 'New',
        tags: [],
        updatedAt: new Date()
      }
    })

    await service.update(99, { content: 'New' })

    expect(mockFileSync.readJournal).toHaveBeenCalledWith(
      expect.any(Date),
      '2026/03/2026-03-30.md'
    )
    expect(mockFileSync.writeJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'New'
      }),
      '2026/03/2026-03-30.md'
    )
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith('2026-03-30')
    expect(mockVaultIndex.upsert).toHaveBeenCalled()
  })

  it('update() with date change should remove old file', async () => {
    const oldDate = parseDateStr('2026-03-30')
    const newDate = parseDateStr('2026-03-31')

    mockShadowRepo.findById.mockResolvedValue({
      id: 99,
      date: '2026-03-30',
      filePath: '',
      contentHash: '',
      createdAt: '',
      updatedAt: '',
      isFavorite: false,
      hasMedia: false,
      weather: null,
      mood: null,
      location: null,
      locationDetail: null,
      vaultName: 'TestVault'
    })

    mockFileSync.readJournal.mockImplementation(async (d) => {
      if (formatLocalDate(d) === formatLocalDate(oldDate))
        return {
          id: 99,
          date: oldDate,
          content: 'Old',
          isFavorite: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          mediaPaths: []
        } as Diary
      return null // new date is clear
    })
    mockShadowSync.syncJournal.mockResolvedValue({
      isChanged: true,
      meta: {
        id: 99,
        date: newDate,
        preview: 'New',
        tags: [],
        updatedAt: new Date()
      }
    })

    await service.update(99, { date: newDate, content: 'New' })

    const deletedDate = mockFileSync.deleteJournalFile.mock.calls[0]![0]!
    expect(formatLocalDate(deletedDate)).toBe('2026-03-30')
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith('2026-03-30') // 删旧
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith('2026-03-31') // 更新新
  })

  it('delete() should delete file and clear index', async () => {
    const existingDateIso = '2026-03-25T00:00:00.000Z'
    mockShadowRepo.findById.mockResolvedValue({
      id: 1,
      date: existingDateIso.split('T')[0]!,
      filePath: '',
      contentHash: '',
      createdAt: '',
      updatedAt: '',
      isFavorite: false,
      hasMedia: false,
      weather: null,
      mood: null,
      location: null,
      locationDetail: null,
      vaultName: 'TestVault'
    })

    await service.delete(1)

    const d = parseDateStr('2026-03-25')
    expect(mockFileSync.deleteJournalFile).toHaveBeenCalledWith(d)
    // 影子同步由于文件没了会执行级联清理
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith('2026-03-25')
    expect(mockVaultIndex.remove).toHaveBeenCalledWith(1)
  })

  describe('save() unified entry', () => {
    it('should create a new diary when id is null and no date conflict', async () => {
      const inputDate = parseDateStr('2026-03-31')
      const input = { date: inputDate, content: 'Test body', isFavorite: false }

      mockFileSync.readJournal.mockResolvedValue(null)
      mockShadowSync.syncJournal.mockResolvedValue({
        isChanged: true,
        meta: { id: 42, date: inputDate, preview: 'Test body', tags: [], updatedAt: inputDate }
      })

      const result = await service.save(null, input)
      expect(result.id).toBe(42)
      expect(mockFileSync.writeJournal).toHaveBeenCalled()
    })

    it('should merge content and tags when id is null and date conflict exists', async () => {
      const inputDate = parseDateStr('2026-03-31')
      const input = { date: inputDate, content: 'Additional text', tags: 'tag2', isFavorite: false }

      const existingDiary: Diary = {
        id: 10,
        date: inputDate,
        content: 'Original text',
        tags: 'tag1',
        isFavorite: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        mediaPaths: []
      }
      mockFileSync.readJournal.mockResolvedValue(existingDiary)
      mockShadowRepo.findById.mockResolvedValue({
        id: 10,
        date: '2026-03-31',
        filePath: '',
        contentHash: '',
        createdAt: '',
        updatedAt: '',
        isFavorite: true,
        hasMedia: false,
        weather: null,
        mood: null,
        location: null,
        locationDetail: null,
        vaultName: 'TestVault'
      })
      mockShadowSync.syncJournal.mockResolvedValue({
        isChanged: true,
        meta: {
          id: 10,
          date: inputDate,
          preview: 'Original text\n\nAdditional text',
          tags: ['tag1', 'tag2'],
          updatedAt: new Date()
        }
      })

      const result = await service.save(null, input)
      expect(result.id).toBe(10)
      expect(mockFileSync.writeJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Original text\n\nAdditional text',
          tags: 'tag1,tag2'
        }),
        ''
      )
    })

    it('should resolve shadow id when existing file has no id frontmatter', async () => {
      const inputDate = parseDateStr('2026-06-24')
      const input = { date: inputDate, content: '追加内容', isFavorite: false }

      mockFileSync.readJournal.mockResolvedValue({
        date: inputDate,
        content: 'Obsidian 正文',
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        mediaPaths: []
      } as Diary)
      mockShadowRepo.findById.mockResolvedValue(null)
      mockShadowRepo.findByDate.mockResolvedValue({
        id: 55,
        date: '2026-06-24',
        filePath: '2026-06-24.md',
        contentHash: '',
        createdAt: '',
        updatedAt: '',
        isFavorite: false,
        hasMedia: false,
        weather: null,
        mood: null,
        location: null,
        locationDetail: null,
        vaultName: 'TestVault'
      })
      mockShadowSync.syncJournal.mockResolvedValue({
        isChanged: false,
        meta: {
          id: 55,
          date: inputDate,
          preview: 'Obsidian 正文\n\n追加内容',
          tags: [],
          updatedAt: new Date()
        }
      })

      const result = await service.save(null, input)
      expect(result.id).toBe(55)
      expect(mockShadowRepo.findByDate).toHaveBeenCalledWith('2026-06-24')
    })

    it('should delegate to update() when id is provided', async () => {
      const inputDate = parseDateStr('2026-03-31')
      const input = { date: inputDate, content: 'Updated content' }

      mockShadowRepo.findById.mockResolvedValue({
        id: 20,
        date: '2026-03-31',
        filePath: '',
        contentHash: '',
        createdAt: '',
        updatedAt: '',
        isFavorite: false,
        hasMedia: false,
        weather: null,
        mood: null,
        location: null,
        locationDetail: null,
        vaultName: 'TestVault'
      })
      mockFileSync.readJournal.mockResolvedValue({
        id: 20,
        date: inputDate,
        content: 'Old content',
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        mediaPaths: []
      })
      mockShadowSync.syncJournal.mockResolvedValue({
        isChanged: true,
        meta: {
          id: 20,
          date: inputDate,
          preview: 'Updated content',
          tags: [],
          updatedAt: new Date()
        }
      })

      const result = await service.save(20, input)
      expect(result.id).toBe(20)
      expect(mockFileSync.writeJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Updated content'
        }),
        ''
      )
    })
  })

  describe('searchPage', () => {
    const shadowRow = (id: number, favorite = false) => ({
      id,
      vaultName: 'default',
      filePath: `d/${id}.md`,
      date: '2026-03-15T00:00:00.000Z',
      createdAt: '2026-03-15T00:00:00.000Z',
      updatedAt: '2026-03-15T00:00:00.000Z',
      contentHash: 'h',
      weather: 'sunny',
      mood: null,
      location: null,
      locationDetail: null,
      isFavorite: favorite,
      hasMedia: false,
      rawContent: 'hello',
      tags: ''
    })

    it('scans multiple FTS batches when favorite filter reduces matches', async () => {
      mockShadowRepo.searchFTS
        .mockResolvedValueOnce([
          {
            rowid: 1,
            contentSnippet: 'a',
            tags: '',
            rankScore: 1,
            indexRow: shadowRow(1, false)
          },
          {
            rowid: 2,
            contentSnippet: 'b',
            tags: '',
            rankScore: 2,
            indexRow: shadowRow(2, true)
          }
        ])
        .mockResolvedValueOnce([
          {
            rowid: 3,
            contentSnippet: 'c',
            tags: '',
            rankScore: 1,
            indexRow: shadowRow(3, true)
          }
        ])

      const { items, hasMore } = await service.searchPage('q', {
        limit: 1,
        offset: 0,
        favorite: true
      })

      expect(items).toHaveLength(1)
      expect(items[0]!.id).toBe(2)
      expect(hasMore).toBe(true)
      expect(mockShadowRepo.searchFTS).toHaveBeenCalledTimes(2)
    })
  })

  describe('findByDate', () => {
    it('passes shadow file path when reading by date from disk', async () => {
      const date = parseDateStr('2025-08-03')
      mockShadowRepo.findByDate.mockResolvedValue({
        id: 12,
        date: '2025-08-03',
        filePath: 'Daily/2025-08-03.md',
        contentHash: '',
        createdAt: '',
        updatedAt: '',
        isFavorite: false,
        hasMedia: false,
        weather: null,
        mood: null,
        location: null,
        locationDetail: null,
        vaultName: 'TestVault'
      })
      mockShadowSync.syncJournal.mockResolvedValue({ isChanged: false, meta: null })
      mockFileSync.readJournal.mockResolvedValue({
        id: 12,
        date,
        content: '外部日记正文',
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        mediaPaths: []
      })

      const result = await service.findByDate(date)

      expect(mockFileSync.readJournal).toHaveBeenCalledWith(date, 'Daily/2025-08-03.md')
      expect(result?.content).toBe('外部日记正文')
    })
  })

  describe('findById', () => {
    it('passes shadow file path when reading from disk', async () => {
      const date = parseDateStr('2025-08-01')
      mockShadowSync.syncJournal.mockResolvedValue({ isChanged: false, meta: null })
      mockShadowRepo.findById.mockResolvedValue({
        id: 10,
        date: '2025-08-01',
        filePath: '2.日记/2025/08/2025-08-01.md',
        contentHash: '',
        createdAt: '',
        updatedAt: '',
        isFavorite: false,
        hasMedia: false,
        weather: null,
        mood: null,
        location: null,
        locationDetail: null,
        vaultName: 'TestVault',
        rawContent: '影子正文'
      })
      mockFileSync.readJournal.mockResolvedValue({
        id: 10,
        date,
        content: '磁盘正文',
        isFavorite: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        mediaPaths: []
      })

      const result = await service.findById(10)

      expect(mockFileSync.readJournal).toHaveBeenCalledWith(date, '2.日记/2025/08/2025-08-01.md')
      expect(result?.content).toBe('磁盘正文')
    })

    it('falls back to shadow raw content when disk read is empty', async () => {
      mockShadowSync.syncJournal.mockResolvedValue({ isChanged: false, meta: null })
      mockShadowRepo.findById.mockResolvedValue({
        id: 11,
        date: '2025-08-02',
        filePath: 'missing/2025-08-02.md',
        contentHash: '',
        createdAt: '',
        updatedAt: '2025-08-02T10:00:00.000Z',
        isFavorite: true,
        hasMedia: false,
        weather: null,
        mood: null,
        location: null,
        locationDetail: null,
        vaultName: 'TestVault',
        rawContent: '仅影子索引中的正文',
        tags: 'a,b'
      })
      mockFileSync.readJournal.mockResolvedValue(null)

      const result = await service.findById(11)

      expect(result?.id).toBe(11)
      expect(result?.content).toBe('仅影子索引中的正文')
      expect(result?.tags).toBe('a,b')
      expect(result?.isFavorite).toBe(true)
    })
  })
})
