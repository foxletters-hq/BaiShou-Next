import { describe, it, expect, beforeEach } from 'vitest'
import { parseDateStr } from '@baishou/shared'
import { createDiaryServiceHarness } from './diary-service.test-helpers'

const TEST_VAULT_ID = 'vlt_test'

describe('DiaryService - Single Source of Truth architecture', () => {
  let mockShadowRepo: ReturnType<typeof createDiaryServiceHarness>['mockShadowRepo']
  let mockFileSync: ReturnType<typeof createDiaryServiceHarness>['mockFileSync']
  let mockShadowSync: ReturnType<typeof createDiaryServiceHarness>['mockShadowSync']
  let service: ReturnType<typeof createDiaryServiceHarness>['service']

  beforeEach(() => {
    ;({ mockShadowRepo, mockFileSync, mockShadowSync, service } = createDiaryServiceHarness())
  })

  describe('searchPage', () => {
    const shadowRow = (id: number, favorite = false) => ({
      id,
      vaultId: TEST_VAULT_ID,
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
        vaultId: TEST_VAULT_ID
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

      expect(mockShadowSync.syncJournal).toHaveBeenCalledWith('2025-08-03', true)
      expect(mockFileSync.readJournal).toHaveBeenCalledWith(date, 'Daily/2025-08-03.md')
      expect(result?.content).toBe('外部日记正文')
    })

    it('returns shadow rawContent without reading disk when index has body', async () => {
      const date = parseDateStr('2025-08-04')
      mockShadowRepo.findByDate.mockResolvedValue({
        id: 13,
        date: '2025-08-04',
        filePath: 'Daily/2025-08-04.md',
        contentHash: 'hash',
        createdAt: '',
        updatedAt: '',
        isFavorite: true,
        hasMedia: false,
        weather: 'sunny',
        mood: 'happy',
        location: null,
        locationDetail: null,
        vaultId: TEST_VAULT_ID,
        rawContent: '影子索引正文',
        tags: '工作,日记'
      })
      mockShadowSync.syncJournal.mockResolvedValue({ isChanged: false, meta: null })

      const result = await service.findByDate(date)

      expect(mockShadowSync.syncJournal).toHaveBeenCalledWith('2025-08-04', true)
      expect(mockFileSync.readJournal).not.toHaveBeenCalled()
      expect(result?.content).toBe('影子索引正文')
      expect(result?.id).toBe(13)
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
        vaultId: TEST_VAULT_ID,
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
        vaultId: TEST_VAULT_ID,
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
