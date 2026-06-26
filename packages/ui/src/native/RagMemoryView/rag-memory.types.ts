import type { EmbeddingMigrationStateView } from '@baishou/shared'

export interface RagConfig {
  ragTopK: number
  ragSimilarityThreshold: number
  ragEnabled: boolean
  batchEmbedConcurrency?: number
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
  searchQuery?: string
  searchMode?: 'semantic' | 'text'
  semanticAvailable?: boolean
  onSemanticUnavailable?: () => void
  migrationState?: EmbeddingMigrationStateView | null
  onChange: (config: RagConfig) => void
  onClearDimension?: () => Promise<void>
  onBatchEmbed?: () => Promise<void>
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
}
