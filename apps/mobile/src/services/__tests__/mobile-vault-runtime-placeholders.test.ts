import { describe, expect, it } from 'vitest'
import { ExternalStorageRequiredError } from '../storage-required.error'
import {
  createUnavailableDiaryService,
  EMPTY_DIARY_SEARCHER,
  createVaultDiaryServiceProxy
} from '../mobile-vault-runtime-placeholders'

describe('createUnavailableDiaryService', () => {
  it('should throw ExternalStorageRequiredError when a write is attempted', async () => {
    const service = createUnavailableDiaryService()
    await expect(service.create({} as never)).rejects.toBeInstanceOf(ExternalStorageRequiredError)
  })

  it('should return empty lists when listing diaries without storage', async () => {
    const service = createUnavailableDiaryService()
    expect(await service.listAll()).toEqual([])
    expect(await service.findById(1)).toBeNull()
  })
})

describe('EMPTY_DIARY_SEARCHER', () => {
  it('should return null content for every requested date when storage is missing', async () => {
    expect(await EMPTY_DIARY_SEARCHER.readByDates(['2026-09-18'])).toEqual([
      { date: '2026-09-18', content: null }
    ])
  })
})

describe('createVaultDiaryServiceProxy', () => {
  it('should call the active stack diary service when a stack is bound', async () => {
    const listAll = async () => [{ id: 1 }] as never
    const proxy = createVaultDiaryServiceProxy({
      current: {
        diaryService: { listAll } as never
      } as never
    })
    expect(await proxy.listAll()).toEqual([{ id: 1 }])
  })
})
