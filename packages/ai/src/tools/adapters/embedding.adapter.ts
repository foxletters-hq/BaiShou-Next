import { ToolEmbeddingService } from '../agent.tool'
import { IAIProvider } from '../../providers/provider.interface'
import { embed } from 'ai'
import { SqliteHybridSearchRepository } from '@baishou/database'
import {
  hashEmbedSourceContent,
  logger,
  mergeEmbedContentHashIntoMetadata,
  toSerializableAiError
} from '@baishou/shared'
import { normalizeEmbeddingVector } from '../../rag/embedding-chunk'
import { SEMANTIC_SEARCH_TIMEOUT_MS, withPromiseTimeout } from '@baishou/shared'

/** 最大分块 token 数（对齐原版 1024 字符≈512 token） */
const MAX_CHUNK_LENGTH = 1024
/** 分块重叠字符数 */
const CHUNK_OVERLAP = 128
/** 单篇日记内分块嵌入并发数（对齐桌面 EmbeddingService） */
const CHUNK_EMBED_CONCURRENCY = 3
const EMBED_MAX_ATTEMPTS = 3

export class EmbeddingAdapter implements ToolEmbeddingService {
  /**
   * @param provider BaiShou 核心层提供的带有 Vercel 标准转化能力的 AI 供应商
   * @param modelId 使用模型的 ID（如 deepseek-chat 或 embedding 模型）
   * @param hybridRepo 向量存库的底层 Drizzle/BetterSqlite3 接口
   */
  constructor(
    private provider: IAIProvider,
    private modelId: string,
    private hybridRepo?: SqliteHybridSearchRepository // 可选，因为如果只调用 embedQuery 不需要入库
  ) {}

  get isConfigured(): boolean {
    return true // 只要它被挂载并传入，就意味着模型算力在线
  }

  get embeddingModelId(): string {
    return this.modelId
  }

  async embedQuery(text: string): Promise<number[] | null> {
    try {
      const { embedding } = await withPromiseTimeout(
        embed({
          model: this.provider.getEmbeddingModel(this.modelId),
          value: text
        }),
        SEMANTIC_SEARCH_TIMEOUT_MS,
        'embedQuery'
      )
      return embedding?.length ? normalizeEmbeddingVector(embedding) : null
    } catch (e) {
      logger.warn('[EmbeddingAdapter] 查询特征抽取失败', { error: e })
      throw toSerializableAiError(e)
    }
  }

  private async embedQueryWithRetry(text: string, label: string): Promise<number[] | null> {
    let lastError: unknown
    for (let attempt = 1; attempt <= EMBED_MAX_ATTEMPTS; attempt++) {
      try {
        const { embedding } = await embed({
          model: this.provider.getEmbeddingModel(this.modelId),
          value: text
        })
        if (embedding?.length) {
          return normalizeEmbeddingVector(embedding)
        }
        lastError = new Error('empty embedding vector')
      } catch (e) {
        lastError = e
        if (attempt < EMBED_MAX_ATTEMPTS) {
          const delayMs = attempt * 1000
          logger.warn(`[EmbeddingAdapter] ${label} retry ${attempt}/${EMBED_MAX_ATTEMPTS}`, {
            error: e
          })
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    }
    logger.error(`[EmbeddingAdapter] ${label} failed`, { error: lastError })
    return null
  }

  async embedText(options: {
    text: string
    sourceType: string
    sourceId: string
    groupId: string
    vaultId: string
    sourceCreatedAt?: number
    metadataJson?: string
    chunkPrefix?: string
    /** 为 true 时，任一分块失败或全部失败均抛出错误（日记嵌入路径使用） */
    requireSuccess?: boolean
    contentHash?: string
  }): Promise<void> {
    if (!this.hybridRepo) {
      throw new Error('hybridRepo must be provided to store embeddings permanently.')
    }
    if (!this.isConfigured) return
    const vaultId = options.vaultId.trim()
    if (!vaultId) {
      throw new Error('embedText: vaultId is required')
    }
    const hybridRepo = this.hybridRepo
    const contentHash = options.contentHash?.trim() || hashEmbedSourceContent(options.text)
    if (!options.text.trim()) {
      await this.writeEmbedLedgerSuccess(hybridRepo, { ...options, contentHash }, vaultId, 0, 0)
      return
    }

    // 对齐原版：长文本先分块，每块独立嵌入入库（分块级有限并发）
    const chunks = splitIntoChunks(options.text)
    let successCount = 0
    let lastDimension = 0
    const metadataJson = mergeEmbedContentHashIntoMetadata(options.metadataJson, contentHash)

    const embedOneChunk = async (index: number): Promise<boolean> => {
      const rawChunk = chunks[index]!
      const chunk = options.chunkPrefix ? `${options.chunkPrefix}${rawChunk}` : rawChunk
      const embVector = await this.embedQueryWithRetry(chunk, `chunk ${index}`)
      if (!embVector) {
        return false
      }

      await hybridRepo.insertEmbedding({
        id: `${options.sourceId}_chunk_${index}`,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        groupId: options.groupId,
        vaultId,
        chunkIndex: index,
        chunkText: chunk,
        metadataJson,
        embedding: embVector,
        modelId: this.modelId,
        sourceCreatedAt: options.sourceCreatedAt ?? Date.now()
      })
      lastDimension = embVector.length
      return true
    }

    for (let start = 0; start < chunks.length; start += CHUNK_EMBED_CONCURRENCY) {
      const end = Math.min(start + CHUNK_EMBED_CONCURRENCY, chunks.length)
      const results = await Promise.all(
        Array.from({ length: end - start }, (_, offset) => embedOneChunk(start + offset))
      )
      successCount += results.filter(Boolean).length
    }

    if (options.requireSuccess && chunks.length > 0) {
      if (successCount === 0) {
        const error = new Error(`Embedding API returned no vectors (model: ${this.modelId})`)
        await this.writeEmbedLedgerFailure(hybridRepo, options, vaultId, error.message)
        throw error
      }
      if (successCount < chunks.length) {
        const error = new Error(
          `Embedding API returned incomplete vectors (${successCount}/${chunks.length} chunks, model: ${this.modelId})`
        )
        await this.writeEmbedLedgerFailure(hybridRepo, options, vaultId, error.message)
        throw error
      }
    }

    if (successCount === chunks.length && chunks.length > 0) {
      await this.writeEmbedLedgerSuccess(
        hybridRepo,
        { ...options, contentHash },
        vaultId,
        chunks.length,
        lastDimension
      )
    }
  }

  private isLedgerSourceType(sourceType: string): boolean {
    return sourceType === 'diary' || sourceType === 'memory'
  }

  private async writeEmbedLedgerSuccess(
    hybridRepo: SqliteHybridSearchRepository,
    options: { sourceType: string; sourceId: string; contentHash?: string },
    vaultId: string,
    chunkCount: number,
    dimension: number
  ): Promise<void> {
    if (!hybridRepo.recordEmbedded || !this.isLedgerSourceType(options.sourceType)) return
    try {
      await hybridRepo.recordEmbedded({
        vaultId,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        contentHash: options.contentHash ?? '',
        chunkCount,
        modelId: this.modelId,
        dimension
      })
    } catch (e) {
      logger.warn('[EmbeddingAdapter] embed_ledger 写入失败', { error: e })
    }
  }

  private async writeEmbedLedgerFailure(
    hybridRepo: SqliteHybridSearchRepository,
    options: { sourceType: string; sourceId: string },
    vaultId: string,
    lastError: string
  ): Promise<void> {
    if (!hybridRepo.recordEmbedFailure || !this.isLedgerSourceType(options.sourceType)) return
    try {
      await hybridRepo.recordEmbedFailure({
        vaultId,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        lastError
      })
    } catch (e) {
      logger.warn('[EmbeddingAdapter] embed_ledger 失败记录写入失败', { error: e })
    }
  }
}

/**
 * 滑动窗口分块（对齐原版 EmbeddingService._splitIntoChunks）
 *
 * 纯字符长度滑动窗口，不做自然断句。
 * 短文本（≤MAX_CHUNK_LENGTH）返回单块。
 */
function splitIntoChunks(text: string): string[] {
  if (text.length <= MAX_CHUNK_LENGTH) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + MAX_CHUNK_LENGTH, text.length)
    chunks.push(text.substring(start, end))
    if (end >= text.length) break
    start = end - CHUNK_OVERLAP
  }

  return chunks
}
