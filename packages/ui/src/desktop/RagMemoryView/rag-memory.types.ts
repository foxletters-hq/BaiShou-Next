import type { EmbeddingMigrationStateView } from '@baishou/shared'

export interface RagConfig {
  ragTopK: number
  ragSimilarityThreshold: number
  ragEnabled: boolean
  batchEmbedConcurrency?: number
  lastDiaryEmbedFailureAt?: number
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
}

export interface RagEntry {
  embeddingId: string
  text: string
  modelId: string
  createdAt: number
  sourceType?: string
  similarity?: number
}

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
  onChange: (config: RagConfig) => void
  onClearDimension?: () => Promise<void>
  onBatchEmbed?: () => Promise<void>
  onAddManualMemory?: () => Promise<void>
  onTriggerMigration?: () => Promise<void>
  onCancelMigration?: () => Promise<void>
  onRestoreMigration?: () => Promise<void>
  onResumeMigration?: () => Promise<void>
  migrationState?: EmbeddingMigrationStateView | null
  migrationCancelBusy?: boolean
  onClearAll?: () => Promise<void>
  onSearch?: (query: string, mode: 'semantic' | 'text') => void
  onDeleteEntry?: (id: string) => Promise<void>
  onEditEntry?: (entry: RagEntry) => Promise<void>
  onNavigateToConfig?: () => void
  onDetectDimension?: () => Promise<void>
  onPageChange?: (page: number, pageSize: number) => void
  onExportEmbeddings?: () => Promise<void>
  onManageBackups?: () => Promise<void>
}
