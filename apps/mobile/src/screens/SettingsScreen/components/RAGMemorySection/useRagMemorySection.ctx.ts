import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { RagConfig, RagEntry, RagStats } from '@baishou/ui/native'
import type { AIProviderConfig } from '@baishou/shared'
import type { BaishouContextValue } from '../../../../providers/baishou-provider/types'
import type { PromptMode } from './rag-memory-section.constants'

export type RagMemorySectionCtx = {
  services: BaishouContextValue['services']
  dbReady: boolean
  storageIndexing: boolean
  ecosystemResyncEpoch: number
  config: RagConfig
  setConfig: Dispatch<SetStateAction<RagConfig>>
  stats: RagStats
  setStats: Dispatch<SetStateAction<RagStats>>
  entries: RagEntry[]
  setEntries: Dispatch<SetStateAction<RagEntry[]>>
  totalCount: number
  setTotalCount: Dispatch<SetStateAction<number>>
  currentPage: number
  setCurrentPage: Dispatch<SetStateAction<number>>
  pageSize: number
  setPageSize: Dispatch<SetStateAction<number>>
  searchQuery: string
  setSearchQuery: Dispatch<SetStateAction<string>>
  searchMode: 'semantic' | 'text'
  setSearchMode: Dispatch<SetStateAction<'semantic' | 'text'>>
  embeddingModelId?: string
  embeddingProviderId?: string
  setEmbeddingModelId: Dispatch<SetStateAction<string | undefined>>
  setEmbeddingProviderId: Dispatch<SetStateAction<string | undefined>>
  providers: AIProviderConfig[]
  setProviders: Dispatch<SetStateAction<AIProviderConfig[]>>
  showModelSwitcher: boolean
  setShowModelSwitcher: Dispatch<SetStateAction<boolean>>
  ragState: ReturnType<
    typeof import('../../../../hooks/useMobileRagSystem').useMobileRagSystem
  >['ragState']
  setRagState: ReturnType<
    typeof import('../../../../hooks/useMobileRagSystem').useMobileRagSystem
  >['setRagState']
  checkModelMismatch: ReturnType<
    typeof import('../../../../hooks/useMobileRagSystem').useMobileRagSystem
  >['checkModelMismatch']
  handleReembedAfterModelChange: ReturnType<
    typeof import('../../../../hooks/useMobileRagSystem').useMobileRagSystem
  >['handleReembedAfterModelChange']
  hasMismatchModel: boolean
  promptMode: PromptMode
  setPromptMode: Dispatch<SetStateAction<PromptMode>>
  promptDefault: string
  setPromptDefault: Dispatch<SetStateAction<string>>
  ragCancelBusy: boolean
  setRagCancelBusy: Dispatch<SetStateAction<boolean>>
  editEntryRef: MutableRefObject<RagEntry | null>
  androidRenderStage: number
  stateRef: MutableRefObject<{
    searchQuery: string
    searchMode: 'semantic' | 'text'
    currentPage: number
    pageSize: number
  }>
}
