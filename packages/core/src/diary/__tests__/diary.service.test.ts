import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DiaryDateConflictError } from '../diary.types'
import { Diary, parseDateStr, formatLocalDate, hashEmbedSourceContent } from '@baishou/shared'
import { createDiaryServiceHarness } from './diary-service.test-helpers'

const TEST_VAULT_ID = 'vlt_test'

describe('DiaryService - Single Source of Truth architecture', () => {
  let mockShadowRepo: ReturnType<typeof createDiaryServiceHarness>['mockShadowRepo']
  let mockFileSync: ReturnType<typeof createDiaryServiceHarness>['mockFileSync']
  let mockShadowSync: ReturnType<typeof createDiaryServiceHarness>['mockShadowSync']
  let mockVaultIndex: ReturnType<typeof createDiaryServiceHarness>['mockVaultIndex']
  let service: ReturnType<typeof createDiaryServiceHarness>['service']

  beforeEach(() => {
    ;({ mockShadowRepo, mockFileSync, mockShadowSync, mockVaultIndex, service } =
      createDiaryServiceHarness())
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
      vaultId: TEST_VAULT_ID
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

    expect(mockFileSync.readJournal).toHaveBeenCalledWith(expect.any(Date), '2026/03/2026-03-30.md')
    expect(mockFileSync.writeJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'New'
      }),
      '2026/03/2026-03-30.md'
    )
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith('2026-03-30')
    expect(mockVaultIndex.upsert).toHaveBeenCalled()
  })

  it('update() 从正文删除标签后不会被旧解析结果补回', async () => {
    const existingDate = parseDateStr('2026-03-30')
    mockShadowRepo.findById.mockResolvedValue({
      id: 99,
      date: '2026-03-30',
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
      vaultId: TEST_VAULT_ID
    })
    mockFileSync.readJournal.mockResolvedValue({
      id: 99,
      date: existingDate,
      content: '#工作\n\n正文',
      tags: '工作',
      isFavorite: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      mediaPaths: []
    })
    mockShadowSync.syncJournal.mockResolvedValue({
      isChanged: true,
      meta: {
        id: 99,
        date: existingDate,
        preview: '正文',
        tags: [],
        updatedAt: new Date()
      }
    })

    await service.update(99, { content: '正文' })

    expect(mockFileSync.writeJournal).toHaveBeenCalledWith(
      expect.objectContaining({ content: '正文', tags: undefined }),
      '2026/03/2026-03-30.md'
    )
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
      vaultId: TEST_VAULT_ID
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
      vaultId: TEST_VAULT_ID
    })

    await service.delete(1)

    const d = parseDateStr('2026-03-25')
    expect(mockFileSync.deleteJournalFile).toHaveBeenCalledWith(d)
    // 影子同步由于文件没了会执行级联清理
    expect(mockShadowSync.syncJournal).toHaveBeenCalledWith('2026-03-25')
    expect(mockVaultIndex.remove).toHaveBeenCalledWith(1)
  })

  it('listForEmbedDetection hashes raw_content and ignores file-level content_hash', async () => {
    mockShadowRepo.listForEmbedDetection = vi.fn().mockResolvedValue([
      {
        id: 7,
        date: '2026-05-10',
        updatedAt: '2026-05-10T08:00:00.000Z',
        rawContent: '正文'
      }
    ])

    const rows = await service.listForEmbedDetection()

    expect(mockShadowRepo.listForEmbedDetection).toHaveBeenCalledTimes(1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.contentHash).toBe(hashEmbedSourceContent('正文'))
    expect(rows[0]?.contentHash).not.toBe('file-md5')
  })
})
