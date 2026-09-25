import type { EmbeddingMigrationStateView, RagVectorKindFilter } from '@baishou/shared'

export interface RagConfig {
  ragTopK: number
  ragSimilarityThreshold: number
  ragEnabled: boolean
  batchEmbedConcurrency?: number
  lastDiaryEmbedFailureAt?: number
  lastDiaryEmbedFailureMessage?: string
  startupEmbedReminder?: boolean
}

export interface RagStats {
  totalCount: number
  currentDimension: number
  totalSizeText: string
  diaryCountForVault?: number
  activeVaultName?: string
}

export interface RagState {
  isRunning: boolean
  type: 'idle' | 'batchEmbed' | 'migration' | 'detect' | string
  progress: number
  total: number
  statusText: string
  statusKey?: string
  error?: string
  paused?: boolean
  cancelling?: boolean
}

export interface RagEntry {
  embeddingId: string
  text: string
  modelId: string
  createdAt: number
  sourceType?: string
  similarity?: number
  sourceId?: string
  tags?: string[]
  sourceSessionId?: string | null
  memoryCreatedAt?: number
  memoryUpdatedAt?: number
  isManual?: boolean
}

export const RAG_DEFAULT_PAGE_SIZE = 10
export const RAG_PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const

export interface RagMemoryViewProps {
  config: RagConfig
  stats: RagStats
  ragState: RagState
  hasMismatchModel: boolean
  embeddingModelId?: string
  entries: RagEntry[]
  totalCount?: number
  currentPage?: number
  pageSize?: number
  searchQuery?: string
  searchMode?: 'semantic' | 'text'
  /** 切换分类、改关键词或翻页时正在重新查询 */
  isSearching?: boolean
  sourceKind?: RagVectorKindFilter
  onSourceKindChange?: (kind: RagVectorKindFilter) => void
  semanticAvailable?: boolean
  onSemanticUnavailable?: () => void
  migrationState?: EmbeddingMigrationStateView | null
  onChange: (config: RagConfig) => void
  onClearDimension?: () => Promise<void>
  onBatchEmbed?: () => Promise<void>
  onPauseBatchEmbed?: () => Promise<void>
  onResumeBatchEmbed?: () => Promise<void>
  onCancelBatchEmbed?: () => Promise<void>
  onAddManualMemory?: () => Promise<void>
  onTriggerMigration?: () => Promise<void>
  onCancelMigration?: () => Promise<void>
  onRestoreMigration?: () => Promise<void>
  onResumeMigration?: () => Promise<void>
  onClearAll?: () => Promise<void>
  onSearch?: (query: string, mode: 'semantic' | 'text') => void
  onDeleteEntry?: (id: string) => Promise<void>
  onEditEntry?: (entry: RagEntry) => Promise<void>
  onNavigateToConfig?: () => void
  /** 点击嵌入模型芯片时打开模型选择（优先于 onNavigateToConfig） */
  onConfigureModel?: () => void
  onDetectDimension?: () => Promise<void>
  onPageChange?: (page: number, pageSize: number) => void
  migrationCancelBusy?: boolean
  suspectCount?: number
  onReviewSuspects?: () => void
}
