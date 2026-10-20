import { describe, it, expect, beforeEach } from 'vitest'
import { Diary, parseDateStr } from '@baishou/shared'
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
        vaultId: TEST_VAULT_ID
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
          content: '#tag1 #tag2\n\nOriginal text\n\nAdditional text',
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
        vaultId: TEST_VAULT_ID
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
        vaultId: TEST_VAULT_ID
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
})
