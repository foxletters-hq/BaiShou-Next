import type { ReactNode } from 'react'
import type {
  EmbeddingMigrationStateView,
  RagBatchEmbedPhaseCounts,
  RagBatchEmbedPhaseKind,
  RagVectorKindFilter
} from '@baishou/shared'

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
  /** 当前工作空间下的日记向量块数 */
  diaryCountForVault?: number
  activeVaultName?: string
}

export interface RagState {
  isRunning: boolean
  type: 'idle' | 'batchEmbed' | 'migration'
  progress: number
  total: number
  statusText: string
  statusKey?: string
  error?: string
  aborted?: boolean
  rollbackApplied?: boolean
  phase?: RagBatchEmbedPhaseKind
  phases?: RagBatchEmbedPhaseCounts
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

export interface RagMemoryViewProps {
  /** 记忆中心内嵌：收起绝对定位顶栏，避免挡住滚动区 */
  embedded?: boolean
  extraStatsChips?: ReactNode
  config: RagConfig
  stats: RagStats
  ragState: RagState
  hasMismatchModel: boolean
  embeddingModelId?: string
  entries: RagEntry[]
  totalCount?: number
  currentPage?: number
  pageSize?: number
  onChange: (config: RagConfig) => void
  onClearDimension?: () => Promise<void>
  onBatchEmbed?: () => Promise<void>
  onAddManualMemory?: () => Promise<void>
  onTriggerMigration?: () => Promise<void>
  onCancelMigration?: () => Promise<void>
  onPauseBatchEmbed?: () => Promise<void>
  onResumeBatchEmbed?: () => Promise<void>
  onCancelBatchEmbed?: () => Promise<void>
  onRestoreMigration?: () => Promise<void>
  onResumeMigration?: () => Promise<void>
  migrationState?: EmbeddingMigrationStateView | null
  migrationCancelBusy?: boolean
  onClearAll?: (kinds: import('@baishou/shared').MemoryClearKind[]) => Promise<void>
  onSearch?: (query: string, mode: 'semantic' | 'text') => void
  /** 切换分类、改关键词或翻页时正在重新查询 */
  isSearching?: boolean
  sourceKind?: RagVectorKindFilter
  onSourceKindChange?: (kind: RagVectorKindFilter) => void
  onDeleteEntry?: (id: string) => Promise<void>
  onEditEntry?: (entry: RagEntry) => Promise<void>
  onNavigateToConfig?: () => void
  onDetectDimension?: () => Promise<void>
  onPageChange?: (page: number, pageSize: number) => void
  onExportEmbeddings?: () => Promise<void>
  onManageBackups?: () => Promise<void>
  graphExtract?: { current: number; total: number; percent: number } | null
  graphExtractWaiting?: boolean
  pendingGraphCount?: number
  suspectCount?: number
  onReviewSuspects?: () => void
  /** 记忆中心把整理进度收到独立弹层时，向量页不再内嵌同一块 */
  hideOrganizeProgress?: boolean
}
