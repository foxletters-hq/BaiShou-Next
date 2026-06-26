import { ToolEmbeddingService } from '../agent.tool'
import { IAIProvider } from '../../providers/provider.interface'
import { embed } from 'ai'
import { SqliteHybridSearchRepository } from '@baishou/database'
import { logger } from '@baishou/shared'
import { normalizeEmbeddingVector } from '../../rag/embedding-chunk'

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

  async embedQuery(text: string): Promise<number[] | null> {
    try {
      const { embedding } = await embed({
        model: this.provider.getEmbeddingModel(this.modelId),
        value: text
      })
      return embedding?.length ? normalizeEmbeddingVector(embedding) : null
    } catch (e) {
      logger.warn('[EmbeddingAdapter] 查询特征抽取失败', { error: e })
      return null
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
    sourceCreatedAt?: number
    metadataJson?: string
    /** 为 true 时，任一分块失败或全部失败均抛出错误（日记嵌入路径使用） */
    requireSuccess?: boolean
  }): Promise<void> {
    if (!this.hybridRepo) {
      throw new Error('hybridRepo must be provided to store embeddings permanently.')
    }
    const hybridRepo = this.hybridRepo

    // 对齐原版：长文本先分块，每块独立嵌入入库（分块级有限并发）
    const chunks = splitIntoChunks(options.text)
    let successCount = 0

    const embedOneChunk = async (index: number): Promise<boolean> => {
      const chunk = chunks[index]!
      const embVector = await this.embedQueryWithRetry(chunk, `chunk ${index}`)
      if (!embVector) {
        return false
      }

      await hybridRepo.insertEmbedding({
        id: `${options.sourceId}_chunk_${index}`,
        sourceType: options.sourceType,
        sourceId: options.sourceId,
        groupId: options.groupId,
        chunkIndex: index,
        chunkText: chunk,
        metadataJson: options.metadataJson || '{}',
        embedding: embVector,
        modelId: this.modelId,
        sourceCreatedAt: options.sourceCreatedAt ?? Date.now()
      })
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
        throw new Error(`Embedding API returned no vectors (model: ${this.modelId})`)
      }
      if (successCount < chunks.length) {
        throw new Error(
          `Embedding API returned incomplete vectors (${successCount}/${chunks.length} chunks, model: ${this.modelId})`
        )
      }
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
