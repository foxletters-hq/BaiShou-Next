import { ToolEmbeddingService } from '../agent.tool'
import { IAIProvider } from '../../providers/provider.interface'
import { embed, embedMany } from 'ai'
import { SqliteHybridSearchRepository } from '@baishou/database'
import {
  hashEmbedSourceContent,
  logger,
  mergeEmbedContentHashIntoMetadata,
  toSerializableAiError
} from '@baishou/shared'
import { normalizeEmbeddingVector, splitTextIntoChunks } from '../../rag/embedding-chunk'
import { withEmbeddingSlot, yieldMainThreadIfNeeded } from '../../rag/embedding-concurrency'

/** 单篇日记内分块嵌入并发数（对齐桌面 EmbeddingService） */
const CHUNK_EMBED_CONCURRENCY = 3
const EMBED_MAX_ATTEMPTS = 3

function isTransientEmbeddingError(error: unknown): boolean {
  const status =
    (error as { statusCode?: number; status?: number } | null)?.statusCode ??
    (error as { status?: number } | null)?.status
  if (status === 408 || status === 429 || (typeof status === 'number' && status >= 500)) {
    return true
  }
  const msg = String((error as { message?: string } | null)?.message ?? error ?? '').toLowerCase()
  return (
    msg.includes('timed out') ||
    msg.includes('timeout') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('429') ||
    msg.includes('econnreset') ||
    msg.includes('fetch failed')
  )
}

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

  private batchUnsupported = false

  async embedQuery(text: string): Promise<number[] | null> {
    try {
      // 整理/对齐会复用这条路径；15 秒是语义搜索的墙钟，不能套在嵌入请求上。
      const { embedding } = await withEmbeddingSlot(() =>
        embed({
          model: this.provider.getEmbeddingModel(this.modelId),
          value: text
        })
      )
      return embedding?.length ? normalizeEmbeddingVector(embedding) : null
    } catch (e) {
      logger.warn('[EmbeddingAdapter] 查询特征抽取失败', { error: e })
      throw toSerializableAiError(e)
    }
  }

  /**
   * 批量嵌入多条短文本（如图谱节点名片）。优先使用单次 HTTP embedMany 请求，
   * 若供应商不支持数组输入则自动降级为有限并发单条 embedQuery。
   */
  async embedBatch(texts: string[]): Promise<Array<number[] | null>> {
    if (texts.length === 0) return []
    if (texts.length === 1) {
      return [await this.embedQuery(texts[0]!)]
    }
    if (!this.batchUnsupported) {
      try {
        const { embeddings } = await withEmbeddingSlot(() =>
          embedMany({
            model: this.provider.getEmbeddingModel(this.modelId),
            values: texts
          })
        )
        if (Array.isArray(embeddings) && embeddings.length === texts.length) {
          return embeddings.map((vec) => (vec?.length ? normalizeEmbeddingVector(vec) : null))
        }
      } catch (e) {
        if (!isTransientEmbeddingError(e)) {
          this.batchUnsupported = true
        }
        logger.warn('[EmbeddingAdapter] embedMany fallback to concurrent embedQuery', { error: e })
      }
    }
    const out: Array<number[] | null> = new Array(texts.length).fill(null)
    let cursor = 0
    const workerCount = Math.min(CHUNK_EMBED_CONCURRENCY, texts.length)
    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (cursor < texts.length) {
          const index = cursor++
          out[index] = await this.embedQuery(texts[index]!)
        }
      })
    )
    return out
  }

  private async embedQueryWithRetry(text: string, label: string): Promise<number[] | null> {
    let lastError: unknown
    for (let attempt = 1; attempt <= EMBED_MAX_ATTEMPTS; attempt++) {
      try {
        const { embedding } = await withEmbeddingSlot(() =>
          embed({
            model: this.provider.getEmbeddingModel(this.modelId),
            value: text
          })
        )
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
    await yieldMainThreadIfNeeded()
    const chunks = splitTextIntoChunks(options.text).map((chunk) => chunk.text)
    await yieldMainThreadIfNeeded()
    let successCount = 0
    let lastDimension = 0
    const metadataJson = mergeEmbedContentHashIntoMetadata(options.metadataJson, contentHash)
    const preparedChunks: Array<{ index: number; chunkText: string; embedding: number[] }> = []
    const prefixedChunks = chunks.map((rawChunk) =>
      options.chunkPrefix ? `${options.chunkPrefix}${rawChunk}` : rawChunk
    )

    let batchDone = false
    if (chunks.length > 1 && !this.batchUnsupported) {
      try {
        const { embeddings } = await withEmbeddingSlot(() =>
          embedMany({
            model: this.provider.getEmbeddingModel(this.modelId),
            values: prefixedChunks
          })
        )
        if (
          Array.isArray(embeddings) &&
          embeddings.length === prefixedChunks.length &&
          embeddings.every((vec) => Array.isArray(vec) && vec.length > 0)
        ) {
          for (let i = 0; i < prefixedChunks.length; i++) {
            const vec = normalizeEmbeddingVector(embeddings[i]!)
            preparedChunks.push({ index: i, chunkText: prefixedChunks[i]!, embedding: vec })
            lastDimension = vec.length
          }
          successCount = prefixedChunks.length
          batchDone = true
        }
      } catch (e) {
        if (!isTransientEmbeddingError(e)) {
          this.batchUnsupported = true
        }
        const msg = String((e as { message?: string } | null)?.message ?? e ?? '')
        if (!msg.includes('No "embedMany" export')) {
          logger.warn('[EmbeddingAdapter] embedText embedMany fallback to per-chunk embed', {
            error: e
          })
        }
      }
    }

    if (!batchDone) {
      const embedOneChunk = async (index: number): Promise<boolean> => {
        const chunk = prefixedChunks[index]!
        const embVector = await this.embedQueryWithRetry(chunk, `chunk ${index}`)
        if (!embVector) {
          return false
        }

        preparedChunks.push({ index, chunkText: chunk, embedding: embVector })
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

    preparedChunks.sort((a, b) => a.index - b.index)
    if (
      typeof hybridRepo.replaceSourceEmbeddings === 'function' &&
      successCount === chunks.length &&
      chunks.length > 0
    ) {
      await hybridRepo.replaceSourceEmbeddings({
        vaultId,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        groupId: options.groupId,
        modelId: this.modelId,
        dimension: lastDimension,
        contentHash,
        metadataJson,
        sourceCreatedAt: options.sourceCreatedAt ?? Date.now(),
        replaceExisting: true,
        recordLedger: this.isLedgerSourceType(options.sourceType),
        chunks: preparedChunks.map((item) => ({
          id: `${options.sourceId}_chunk_${item.index}`,
          chunkIndex: item.index,
          chunkText: item.chunkText,
          embedding: item.embedding
        }))
      })
      return
    }

    for (const item of preparedChunks) {
      await hybridRepo.insertEmbedding({
        id: `${options.sourceId}_chunk_${item.index}`,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        groupId: options.groupId,
        vaultId,
        chunkIndex: item.index,
        chunkText: item.chunkText,
        metadataJson,
        embedding: item.embedding,
        modelId: this.modelId,
        sourceCreatedAt: options.sourceCreatedAt ?? Date.now()
      })
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

  /**
   * 批量嵌入多条记录（如多条伙伴记忆），将所有分块合并为单次 embedBatch 请求，
   * 随后按各记录原子替换入库。
   */
  async embedTextsBatch(
    items: ReadonlyArray<{
      text: string
      sourceType: string
      sourceId: string
      groupId: string
      vaultId: string
      sourceCreatedAt?: number
      metadataJson?: string
      chunkPrefix?: string
      contentHash?: string
    }>
  ): Promise<void> {
    if (!this.hybridRepo) {
      throw new Error('hybridRepo must be provided to store embeddings permanently.')
    }
    if (!this.isConfigured || items.length === 0) return
    const hybridRepo = this.hybridRepo

    type PreparedItem = {
      options: (typeof items)[number]
      vaultId: string
      contentHash: string
      metadataJson: string
      prefixedChunks: string[]
      startOffset: number
    }
    const nonEmptyItems: PreparedItem[] = []
    const allChunkTexts: string[] = []

    for (const item of items) {
      const vaultId = item.vaultId.trim()
      if (!vaultId) {
        throw new Error('embedTextsBatch: vaultId is required')
      }
      const contentHash = item.contentHash?.trim() || hashEmbedSourceContent(item.text)
      if (!item.text.trim()) {
        await this.writeEmbedLedgerSuccess(hybridRepo, { ...item, contentHash }, vaultId, 0, 0)
        continue
      }
      const chunks = splitTextIntoChunks(item.text).map((c) =>
        item.chunkPrefix ? `${item.chunkPrefix}${c.text}` : c.text
      )
      const startOffset = allChunkTexts.length
      allChunkTexts.push(...chunks)
      nonEmptyItems.push({
        options: item,
        vaultId,
        contentHash,
        metadataJson: mergeEmbedContentHashIntoMetadata(item.metadataJson, contentHash),
        prefixedChunks: chunks,
        startOffset
      })
    }

    if (nonEmptyItems.length === 0) return

    const vectors = await this.embedBatch(allChunkTexts)

    for (const entry of nonEmptyItems) {
      const { options, vaultId, contentHash, metadataJson, prefixedChunks, startOffset } = entry
      const chunkVectors = prefixedChunks.map((_, idx) => vectors[startOffset + idx] ?? null)
      if (chunkVectors.some((v) => !v || v.length === 0)) {
        await this.embedText(options)
        continue
      }
      const dimension = chunkVectors[0]!.length
      if (typeof hybridRepo.replaceSourceEmbeddings === 'function') {
        await hybridRepo.replaceSourceEmbeddings({
          vaultId,
          sourceType: options.sourceType,
          sourceId: options.sourceId,
          groupId: options.groupId,
          modelId: this.modelId,
          dimension,
          contentHash,
          metadataJson,
          sourceCreatedAt: options.sourceCreatedAt ?? Date.now(),
          replaceExisting: true,
          recordLedger: this.isLedgerSourceType(options.sourceType),
          chunks: prefixedChunks.map((chunkText, index) => ({
            id: `${options.sourceId}_chunk_${index}`,
            chunkIndex: index,
            chunkText,
            embedding: chunkVectors[index]!
          }))
        })
      } else {
        for (let index = 0; index < prefixedChunks.length; index++) {
          await hybridRepo.insertEmbedding({
            id: `${options.sourceId}_chunk_${index}`,
            sourceType: options.sourceType,
            sourceId: options.sourceId,
            groupId: options.groupId,
            vaultId,
            chunkIndex: index,
            chunkText: prefixedChunks[index]!,
            metadataJson,
            embedding: chunkVectors[index]!,
            modelId: this.modelId,
            sourceCreatedAt: options.sourceCreatedAt ?? Date.now()
          })
        }
        await this.writeEmbedLedgerSuccess(
          hybridRepo,
          { ...options, contentHash },
          vaultId,
          prefixedChunks.length,
          dimension
        )
      }
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
