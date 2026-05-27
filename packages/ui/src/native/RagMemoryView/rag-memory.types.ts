export interface RagConfig {
  ragTopK: number
  ragSimilarityThreshold: number
  ragEnabled: boolean
}

export interface RagStats {
  totalCount: number
  currentDimension: number
  totalSizeText: string
}

export interface RagState {
  isRunning: boolean
  type: string
  progress: number
  total: number
  statusText: string
}

export interface RagEntry {
  embeddingId: string
  text: string
  modelId: string
  createdAt: number
  similarity?: number
}

export interface RagMemoryViewProps {
  config: RagConfig
  stats: RagStats
  ragState: RagState
  hasMismatchModel: boolean
  embeddingModelId?: string
  entries: RagEntry[]
  onChange: (config: RagConfig) => void
  onClearDimension?: () => Promise<void>
  onBatchEmbed?: () => Promise<void>
  onClearAll?: () => Promise<void>
  onDetectDimension?: () => Promise<void>
  onSearch?: (query: string, mode: string) => void
  onDeleteEntry?: (id: string) => Promise<void>
}
