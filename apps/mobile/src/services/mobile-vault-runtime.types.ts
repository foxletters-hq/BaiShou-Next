import type { ShadowIndexSyncService, DiaryService } from '@baishou/core-mobile'
import type { ShadowIndexRepository } from '@baishou/database'
import type { ToolDiaryMutationResult } from '@baishou/ai'
import type { createShadowDiaryRepoAdapter } from './shadow-diary-adapter'

export type VaultDiarySearcher = {
  searchFTS: (
    query: string,
    limit?: number
  ) => Promise<Array<{ date: string; contentSnippet: string; tags: string; rankScore: number }>>
  listInDateRange: (
    startDate: string,
    endDate: string
  ) => Promise<Array<{ date: string; preview: string }>>
  readByDates: (dates: string[]) => Promise<Array<{ date: string; content: string | null }>>
  writeEntry: (date: string, content: string, tags?: string) => Promise<ToolDiaryMutationResult>
  editEntry: (args: {
    date: string
    content: string
    mode?: 'append' | 'overwrite'
    tags?: string
  }) => Promise<ToolDiaryMutationResult>
  deleteEntry: (date: string) => Promise<ToolDiaryMutationResult>
}

export type VaultBoundDiaryStack = {
  shadowRepo: ShadowIndexRepository
  shadowIndexSyncService: ShadowIndexSyncService
  diaryService: DiaryService
  diaryRepoAdapter: ReturnType<typeof createShadowDiaryRepoAdapter>
  diarySearcher: VaultDiarySearcher
}

export type VaultSwitchCallbacks = {
  onStackInvalidated?: () => void
  onStackReady?: (stack: VaultBoundDiaryStack) => void
  onResyncComplete?: () => void
}

export type ActivateVaultRuntimeOptions = {
  deferResync?: boolean
  forceDeferResync?: boolean
  forceShadowResync?: boolean
  resyncReason?: string
  onResyncComplete?: () => void
}

export type StorageRootRebootstrapOptions = {
  blockingResync?: boolean
}
