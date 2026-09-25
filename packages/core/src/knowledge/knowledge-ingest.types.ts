import type { KnowledgeRepository } from '@baishou/database/shared'
import type { NotebookRawManager } from '../raw-data/managers/notebook.raw-manager'
import type { IFileSystem } from '../fs/file-system.types'
import type { ExtractEngineId } from './extract-engines'

export interface KnowledgeIngestEmbeddingConfig {
  isConfigured: boolean
  getModelId(): string
  getProviderInstance(): Promise<{ getEmbeddingModel: (id: string) => unknown } | null>
}

export interface KnowledgeExtractConfig {
  defaultEngine?: ExtractEngineId
  ocrLanguage?: string
  ocrDpi?: number
  /** OCR / vision 并发页数（1–10） */
  ocrConcurrency?: number
  visionModelConfigured?: boolean
  visionModelId?: string | null
}

export interface KnowledgeExtractProgress {
  sourceId: string
  page: number
  total: number
  phase?: 'ocr' | 'vision' | 'render' | 'embed' | 'parse' | 'recognize'
}

export interface KnowledgeIngestDeps {
  repo: KnowledgeRepository
  notebookManager: NotebookRawManager
  fs: IFileSystem
  /** 当前活跃仓库 id；写入 knowledge.db 时必填 */
  getVaultId: () => string
  embedding?: KnowledgeIngestEmbeddingConfig
  /** 提取引擎偏好；可每次 process 时覆盖 */
  getExtractConfig?: () => Promise<KnowledgeExtractConfig> | KnowledgeExtractConfig
  /** OCR / vision 逐页进度（可选） */
  onExtractProgress?: (info: KnowledgeExtractProgress) => void
  insertChunk: (params: {
    chunkId: string
    notebookId: string
    sourceId: string
    chunkIndex: number
    chunkText: string
    metadataJson?: string
    embedding: number[]
    modelId: string
    vaultId: string
  }) => Promise<void>
  deleteChunksBySource: (sourceId: string) => Promise<void>
  /** 可选：真实网络嵌入；缺省时用 insertChunk 传入的向量由调用方 mock */
  embedText?: (text: string, modelId: string) => Promise<number[]>
  extractNotebookGraph?: (input: {
    vaultId: string
    notebookId: string
    sourceId: string
    sourceTitle: string
    text: string
    textHash: string
    pages?: Array<{ page: number; start: number; end: number }> | null
    force?: boolean
  }) => Promise<void>
  deleteNotebookGraphSource?: (input: { notebookId: string; sourceId: string }) => Promise<void>
}

export type KnowledgeExtractOverride = {
  forceEngine?: ExtractEngineId
  pageNumbers?: number[]
  onlyMissingPages?: boolean
}
