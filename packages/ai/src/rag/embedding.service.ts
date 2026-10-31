// @ts-ignore
import { v4 as uuidv4 } from 'uuid'
import { embed, embedMany } from 'ai'
import {
  formatAiApiCallError,
  toSerializableAiError,
  deriveLegacyVaultId,
  isVaultId,
  logger,
  hashEmbedSourceContent,
  mergeEmbedContentHashIntoMetadata
} from '@baishou/shared'

import {
  IEmbeddingConfig,
  IEmbeddingStorage,
  ChunkResult,
  MigrationProgress
} from './embedding.types'
import { splitTextIntoChunks, normalizeEmbeddingVector } from './embedding-chunk'
import {
  migrateEmbeddings as runMigrateEmbeddings,
  continueMigration as runContinueMigration,
  type EmbeddingMigrationDeps,
  type MigrationLifecycle
} from './embedding-migration'
import {
  migrationControl,
  type MigrationControl,
  MigrationAbortError,
  abortableDelay
} from './migration-control'
import { withEmbeddingSlot, yieldMainThreadIfNeeded } from './embedding-concurrency'
import type { EmbeddingMigrationRollbackConfig } from '@baishou/shared'

/** Migration path uses createMigrationBackup, clearAndReinitEmbeddings, doReEmbedFromBackup (embedding-migration.ts). */

export class EmbeddingService {
  private readonly migrationRef = { current: false }
  private rollbackConfig?: EmbeddingMigrationRollbackConfig
  private migrationLifecycle?: MigrationLifecycle
  private batchUnsupported = false

  constructor(
    private readonly config: IEmbeddingConfig,
    private readonly db: IEmbeddingStorage
  ) {}

  public get isConfigured(): boolean {
    const modelId = this.config.getGlobalEmbeddingModelId()
    const providerId = this.config.getGlobalEmbeddingProviderId()
    return Boolean(modelId && providerId)
  }

  public async detectDimension(): Promise<number> {
    if (!this.isConfigured) return 0

    const cachedDimension = this.config.getGlobalEmbeddingDimension()
    if (cachedDimension && cachedDimension > 0) return cachedDimension

    try {
      const modelId = this.config.getGlobalEmbeddingModelId()
      const provider = await this.config.getProviderInstance()

      if (!provider) return 0

      const model = provider.getEmbeddingModel(modelId)
      const { embedding } = await withEmbeddingSlot(() =>
        embed({
          model,
          value: 'hi'
        })
      )
      const dimension = embedding.length
      await this.config.setGlobalEmbeddingDimension(dimension)
      logger.debug(`EmbeddingService: Detected dimension ${dimension} (${modelId})`)
      return dimension
    } catch (e: unknown) {
      logger.error('EmbeddingService: Dimension detection failed', {
        error: e
      })
      throw new Error(`连接或鉴权失败: ${formatAiApiCallError(e)}`)
    }
  }

  public async embedMessage(params: {
    messageId: string
    sessionId: string
    content: string
    vaultId: string
  }): Promise<void> {
    if (!this.isConfigured || !params.content.trim()) return
    const vaultId = params.vaultId.trim()
    if (!vaultId) return

    try {
      const modelId = this.config.getGlobalEmbeddingModelId()
      const provider = await this.config.getProviderInstance()
      if (!provider) return

      const aiModel = provider.getEmbeddingModel(modelId)

      const currentDim = await this.detectDimension()
      if (currentDim > 0) {
        await this.db.initVectorIndex(currentDim)
      }

      const chunks = this.splitIntoChunks(params.content)

      for (const chunk of chunks) {
        await this.retryEmbed(async () => {
          const { embedding } = await withEmbeddingSlot(() =>
            embed({
              model: aiModel,
              value: chunk.text
            })
          )

          await this.db.insertEmbedding({
            id: uuidv4(),
            sourceType: 'chat',
            sourceId: params.messageId,
            groupId: params.sessionId,
            vaultId,
            chunkIndex: chunk.index,
            chunkText: chunk.text,
            embedding: this.normalize(embedding),
            modelId: modelId
          })
        }, `embedMessage chunk ${chunk.index}`)
      }
    } catch (e) {
      logger.error('Embedding failed', { error: e })
    }
  }

  public async embedQuery(query: string): Promise<number[] | null> {
    if (!this.isConfigured) return null
    try {
      const modelId = this.config.getGlobalEmbeddingModelId()
      const provider = await this.config.getProviderInstance()
      if (!provider) {
        throw new Error('嵌入服务商实例不可用')
      }

      const aiModel = provider.getEmbeddingModel(modelId)
      const { embedding } = await withEmbeddingSlot(() =>
        embed({
          model: aiModel,
          value: query
        })
      )

      return this.normalize(embedding)
    } catch (e) {
      logger.error('Query embedding failed', { error: e })
      throw toSerializableAiError(e)
    }
  }

  /**
   * 就地替换单个切片的向量，不动同来源的其他切片。
   *
   * 只允许不进账本的来源类型（chat 等）。日记与伙伴记忆必须走 reEmbedText：
   * 就地替换不改变切片总数，计数自检因此抓不到任何异常，而账本的 content_hash
   * 与 model_id 会停在旧值——换过模型之后这一个切片会静默变成异构向量。
   */
  public async updateMemoryChunk(params: { entry: any; newText: string }): Promise<void> {
    const entrySourceType = String(params.entry?.source_type ?? '')
    if (this.isLedgerSourceType(entrySourceType)) {
      throw new Error(
        `updateMemoryChunk 不支持 ${entrySourceType}：日记与伙伴记忆必须走 reEmbedText，否则账本会停在旧的内容哈希与模型上`
      )
    }
    if (!this.isConfigured || !params.newText.trim()) return

    const modelId = this.config.getGlobalEmbeddingModelId()
    const provider = await this.config.getProviderInstance()
    if (!provider) return

    const aiModel = provider.getEmbeddingModel(modelId)
    const rawVault = String(
      params.entry.vault_id ??
        params.entry.vaultId ??
        params.entry.vault_name ??
        params.entry.vaultName ??
        ''
    ).trim()
    if (!rawVault) {
      throw new Error('updateMemoryChunk: entry vault_id is required')
    }
    const vaultId = isVaultId(rawVault) ? rawVault : deriveLegacyVaultId(rawVault)

    await this.retryEmbed(async () => {
      const { embedding } = await withEmbeddingSlot(() =>
        embed({
          model: aiModel,
          value: params.newText
        })
      )

      await this.db.insertEmbedding({
        id: params.entry.embedding_id,
        sourceType: params.entry.source_type,
        sourceId: params.entry.source_id,
        groupId: params.entry.group_id,
        vaultId,
        chunkIndex: params.entry.chunk_index,
        chunkText: params.newText,
        metadataJson: params.entry.metadata_json || '{}',
        embedding: this.normalize(embedding),
        modelId
      })
    }, `updateMemoryChunk ${params.entry.embedding_id}`)
  }

  /** Call once before parallel batch embed to avoid per-item dimension probes. */
  public async prepareEmbeddingIndex(): Promise<void> {
    const currentDim = await this.detectDimension()
    if (currentDim > 0) {
      await this.db.initVectorIndex(currentDim)
    }
  }

  public async embedText(params: {
    text: string
    sourceType: string
    sourceId: string
    groupId: string
    vaultId: string
    metadataJson?: string
    sourceCreatedAt?: number
    chunkPrefix?: string
    /** Skip dimension detect / index init when batch caller already ran prepareEmbeddingIndex(). */
    skipIndexPrep?: boolean
    contentHash?: string
    /** 为 true 时在全部分块向量就绪后原子替换旧向量，避免先删后等网络请求造成空窗 */
    replaceExisting?: boolean
  }): Promise<void> {
    if (!this.isConfigured) return
    const vaultId = params.vaultId.trim()
    if (!vaultId) {
      throw new Error('embedText: vaultId is required')
    }
    const contentHash = params.contentHash?.trim() || hashEmbedSourceContent(params.text)
    if (!params.text.trim()) {
      const modelId = this.config.getGlobalEmbeddingModelId() || ''
      const dimension = this.config.getGlobalEmbeddingDimension() || 0
      if (this.db.replaceSourceEmbeddings) {
        await this.db.replaceSourceEmbeddings({
          vaultId,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          groupId: params.groupId,
          modelId,
          dimension,
          contentHash,
          replaceExisting: params.replaceExisting,
          recordLedger: this.isLedgerSourceType(params.sourceType),
          chunks: []
        })
      } else {
        if (params.replaceExisting) {
          await this.db.deleteEmbeddingsBySource(params.sourceType, params.sourceId)
        }
        await this.writeEmbedLedgerSuccess({
          vaultId,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          contentHash,
          chunkCount: 0,
          modelId,
          dimension
        })
      }
      return
    }

    try {
      const modelId = this.config.getGlobalEmbeddingModelId()
      const provider = await this.config.getProviderInstance()
      if (!provider) return

      const aiModel = provider.getEmbeddingModel(modelId)
      const metadataJson = mergeEmbedContentHashIntoMetadata(params.metadataJson, contentHash)

      if (!params.skipIndexPrep) {
        await this.prepareEmbeddingIndex()
      }

      await yieldMainThreadIfNeeded()
      const chunks = this.splitIntoChunks(params.text)
      await yieldMainThreadIfNeeded()

      const preparedChunks: Array<{ index: number; text: string; vector: number[] }> = []
      const prefixedInputs = chunks.map((chunk) =>
        params.chunkPrefix ? `${params.chunkPrefix}${chunk.text}` : chunk.text
      )

      let batchEmbedded = false
      if (chunks.length > 1 && !this.batchUnsupported) {
        try {
          const { embeddings } = await withEmbeddingSlot(() =>
            embedMany({
              model: aiModel,
              values: prefixedInputs
            })
          )
          if (
            Array.isArray(embeddings) &&
            embeddings.length === chunks.length &&
            embeddings.every((vec) => Array.isArray(vec) && vec.length > 0)
          ) {
            for (let i = 0; i < chunks.length; i++) {
              preparedChunks.push({
                index: chunks[i]!.index,
                text: prefixedInputs[i]!,
                vector: this.normalize(embeddings[i]!)
              })
            }
            batchEmbedded = true
          }
        } catch (err) {
          const status =
            (err as { statusCode?: number; status?: number } | null)?.statusCode ??
            (err as { status?: number } | null)?.status
          if (status !== 408 && status !== 429 && (typeof status !== 'number' || status < 500)) {
            this.batchUnsupported = true
          }
          const msg = String((err as { message?: string } | null)?.message ?? err ?? '')
          if (!msg.includes('No "embedMany" export')) {
            logger.warn('[EmbeddingService] embedMany fallback to per-chunk embed', { error: err })
          }
        }
      }

      if (!batchEmbedded) {
        // 批量路径（skipIndexPrep）不再叠加分块并发，避免「日记并发 × 分块并发」把主进程/API 打满。
        const chunkParallel = params.skipIndexPrep ? 1 : 3
        const futures: Promise<void>[] = []

        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i]!
          const embeddingInput = prefixedInputs[i]!

          const future = this.retryEmbed(async () => {
            const { embedding } = await withEmbeddingSlot(() =>
              embed({
                model: aiModel,
                value: embeddingInput
              })
            )
            preparedChunks.push({
              index: chunk.index,
              text: embeddingInput,
              vector: this.normalize(embedding)
            })
          }, `embedText chunk ${chunk.index}`)

          futures.push(future)

          if (futures.length >= chunkParallel) {
            await Promise.all(futures)
            futures.length = 0
          }
        }

        if (futures.length > 0) {
          await Promise.all(futures)
        }
      }

      preparedChunks.sort((a, b) => a.index - b.index)
      const actualDimension =
        preparedChunks[0]?.vector.length || this.config.getGlobalEmbeddingDimension() || 0

      if (this.db.replaceSourceEmbeddings) {
        await this.db.replaceSourceEmbeddings({
          vaultId,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          groupId: params.groupId,
          modelId,
          dimension: actualDimension,
          contentHash,
          metadataJson,
          sourceCreatedAt: params.sourceCreatedAt,
          replaceExisting: params.replaceExisting,
          recordLedger: this.isLedgerSourceType(params.sourceType),
          chunks: preparedChunks.map((item) => ({
            id: uuidv4(),
            chunkIndex: item.index,
            chunkText: item.text,
            embedding: item.vector
          }))
        })
      } else {
        if (params.replaceExisting) {
          await this.db.deleteEmbeddingsBySource(params.sourceType, params.sourceId)
        }
        for (const item of preparedChunks) {
          await this.db.insertEmbedding({
            id: uuidv4(),
            sourceType: params.sourceType,
            sourceId: params.sourceId,
            groupId: params.groupId,
            vaultId,
            chunkIndex: item.index,
            chunkText: item.text,
            metadataJson,
            embedding: item.vector,
            modelId,
            sourceCreatedAt: params.sourceCreatedAt
          })
        }

        await this.writeEmbedLedgerSuccess({
          vaultId,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          contentHash,
          chunkCount: chunks.length,
          modelId,
          dimension: actualDimension
        })
      }
    } catch (e) {
      logger.error('embedText failed', { error: e })
      await this.writeEmbedLedgerFailure({
        vaultId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        lastError: formatAiApiCallError(e)
      })
      throw e
    }
  }

  public async reEmbedText(params: {
    text: string
    sourceType: string
    sourceId: string
    groupId: string
    vaultId: string
    metadataJson?: string
    sourceCreatedAt?: number
    chunkPrefix?: string
    skipIndexPrep?: boolean
    contentHash?: string
  }): Promise<void> {
    await this.embedText({ ...params, replaceExisting: true })
  }

  public async reEmbedMessage(params: {
    messageId: string
    sessionId: string
    content: string
    vaultId: string
  }): Promise<void> {
    await this.db.deleteEmbeddingsBySource('chat', params.messageId)
    await this.embedMessage(params)
  }

  public async hasPendingMigration(): Promise<boolean> {
    return this.db.hasPendingMigration()
  }

  public async hasHeterogeneousEmbeddings(): Promise<boolean> {
    const currentGlobalModelId = this.config.getGlobalEmbeddingModelId()
    if (!currentGlobalModelId) return false
    const count = await this.db.countHeterogeneousEmbeddings(currentGlobalModelId)
    return count > 0
  }

  public async clearAllEmbeddings(): Promise<void> {
    await this.db.clearEmbeddings()
    await this.config.setGlobalEmbeddingDimension(0)
  }

  public setMigrationLifecycle(lifecycle: MigrationLifecycle): void {
    this.migrationLifecycle = lifecycle
  }

  public async *migrateEmbeddings(
    rollbackConfig?: EmbeddingMigrationRollbackConfig
  ): AsyncGenerator<MigrationProgress, void, unknown> {
    this.rollbackConfig = rollbackConfig
    yield* runMigrateEmbeddings(this.migrationDeps(), this.migrationRef, migrationControl)
  }

  public async *continueMigration(
    rollbackConfig?: EmbeddingMigrationRollbackConfig
  ): AsyncGenerator<MigrationProgress, void, unknown> {
    if (rollbackConfig) {
      this.rollbackConfig = rollbackConfig
    }
    yield* runContinueMigration(this.migrationDeps(), this.migrationRef, migrationControl)
  }

  public isMigrationRunning(): boolean {
    return this.migrationRef.current
  }

  public requestMigrationAbort(): void {
    migrationControl.requestAbort()
  }

  public getMigrationControl(): MigrationControl {
    return migrationControl
  }

  public splitIntoChunks(text: string): ChunkResult[] {
    return splitTextIntoChunks(text)
  }

  public normalize(vec: number[]): number[] {
    return normalizeEmbeddingVector(vec)
  }

  private migrationDeps(): EmbeddingMigrationDeps {
    return {
      config: this.config,
      db: this.db,
      isConfigured: this.isConfigured,
      retryEmbed: (action, label) => this.retryEmbed(action, label),
      rollbackConfig: this.rollbackConfig,
      lifecycle: this.migrationLifecycle
    }
  }

  private isLedgerSourceType(sourceType: string): boolean {
    return sourceType === 'diary' || sourceType === 'memory'
  }

  private async writeEmbedLedgerSuccess(params: {
    vaultId: string
    sourceType: string
    sourceId: string
    contentHash: string
    chunkCount: number
    modelId: string
    dimension: number
  }): Promise<void> {
    if (!this.db.recordEmbedded || !this.isLedgerSourceType(params.sourceType)) return
    try {
      await this.db.recordEmbedded(params)
    } catch (e) {
      logger.warn('embed_ledger 写入失败', { error: e })
    }
  }

  private async writeEmbedLedgerFailure(params: {
    vaultId: string
    sourceType: string
    sourceId: string
    lastError: string
  }): Promise<void> {
    if (!this.db.recordEmbedFailure || !this.isLedgerSourceType(params.sourceType)) return
    try {
      await this.db.recordEmbedFailure(params)
    } catch (e) {
      logger.warn('embed_ledger 失败记录写入失败', { error: e })
    }
  }

  private async retryEmbed(
    action: () => Promise<void>,
    label: string = '',
    maxAttempts = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (migrationControl.isAborted) {
        throw new MigrationAbortError()
      }
      try {
        await action()
        return
      } catch (error) {
        if (error instanceof MigrationAbortError) throw error
        if (migrationControl.isAborted) {
          throw new MigrationAbortError()
        }
        if (attempt < maxAttempts) {
          const delayMs = attempt * 1000
          logger.warn(
            `${label} fallback (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`,
            { error }
          )
          await abortableDelay(delayMs, migrationControl)
        } else {
          logger.error(`${label} failed completely:`, { error })
          throw error
        }
      }
    }
  }
}
