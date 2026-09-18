import { DiaryService } from '@baishou/core-mobile'
import type { ToolDiaryMutationResult } from '@baishou/ai'
import type { DiaryRepository } from '@baishou/database'
import { ExternalStorageRequiredError } from './storage-required.error'
import type { VaultBoundDiaryStack, VaultDiarySearcher } from './mobile-vault-runtime.types'

export const EMPTY_DIARY_REPO_ADAPTER: Pick<DiaryRepository, 'list' | 'findByDateRange'> = {
  list: async () => [],
  findByDateRange: async () => []
}

/** 无外部存储时占位 DiaryService（只读返回空，写入抛错） */
export function createUnavailableDiaryService(): DiaryService {
  const emptyList = async () => [] as Awaited<ReturnType<DiaryService['listFiltered']>>
  const emptyCount = async () => 0
  const emptyNull = async () => null
  const requireStorage = async () => {
    throw new ExternalStorageRequiredError()
  }
  return {
    listAll: emptyList,
    listForEmbedDetection: emptyList,
    listFiltered: emptyList,
    count: emptyCount,
    countFiltered: emptyCount,
    search: emptyList,
    searchPage: async () => ({ items: [], hasMore: false }),
    countSearch: emptyCount,
    findById: emptyNull,
    findByDate: emptyNull,
    findMetaByIds: emptyList,
    create: requireStorage,
    update: requireStorage,
    delete: requireStorage
  } as unknown as DiaryService
}

const diaryMutationUnavailable = async (): Promise<ToolDiaryMutationResult> => ({
  ok: false,
  message: 'Error: Diary storage is not available. Please configure external storage first.'
})

export const EMPTY_DIARY_SEARCHER: VaultDiarySearcher = {
  searchFTS: async () => [],
  listInDateRange: async () => [],
  readByDates: async (dates) => dates.map((date) => ({ date, content: null })),
  writeEntry: diaryMutationUnavailable,
  editEntry: diaryMutationUnavailable,
  deleteEntry: diaryMutationUnavailable
}

/** 始终委托到 diaryStackRef.current，避免 Vault 切换后仍访问已关闭的 Shadow DB */
export function createVaultDiaryServiceProxy(stackRef: {
  current: VaultBoundDiaryStack | null
}): DiaryService {
  const unavailable = createUnavailableDiaryService()
  return new Proxy(unavailable, {
    get(_target, prop) {
      const active = stackRef.current?.diaryService ?? unavailable
      const value = Reflect.get(active as object, prop, active)
      if (typeof value === 'function') {
        return (...args: unknown[]) => (value as (...a: unknown[]) => unknown).apply(active, args)
      }
      return value
    }
  }) as DiaryService
}
