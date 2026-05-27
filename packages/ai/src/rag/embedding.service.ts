// @ts-ignore
import { v4 as uuidv4 } from 'uuid'
import { embed } from 'ai'
import { logger } from '@baishou/shared'

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
  type EmbeddingMigrationDeps
} from './embedding-migration'

/** Migration path uses createMigrationBackup, clearAndReinitEmbeddings, doReEmbedFromBackup (embedding-migration.ts). */

export class EmbeddingService {
  private readonly migrationRef = { current: false }

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
      const { embedding } = await embed({
        model,
        value: 'hi'
      })
      const dimension = embedding.length
      await this.config.setGlobalEmbeddingDimension(dimension)
      logger.debug(`EmbeddingService: Detected dimension ${dimension} (${modelId})`)
      return dimension
    } catch (e: any) {
      logger.error('EmbeddingService: Dimension detection failed', {
        error: e
      })
      throw new Error(`连接或鉴权失败: ${e.message || String(e)}`)
    }
  }

  public async embedMessage(params: {
    messageId: string
    sessionId: string
    content: string
  }): Promise<void> {
    if (!this.isConfigured || !params.content.trim()) return

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
          const { embedding } = await embed({
            model: aiModel,
            value: chunk.text
          })

          await this.db.insertEmbedding({
            id: uuidv4(),
            sourceType: 'chat',
            sourceId: params.messageId,
            groupId: params.sessionId,
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
      if (!provider) return null

      const aiModel = provider.getEmbeddingModel(modelId)
      const { embedding } = await embed({
        model: aiModel,
        value: query
      })

      return this.normalize(embedding)
    } catch (e) {
      logger.error('Query embedding failed', { error: e })
      return null
    }
  }

  public async updateMemoryChunk(params: { entry: any; newText: string }): Promise<void> {
    if (!this.isConfigured || !params.newText.trim()) return

    const modelId = this.config.getGlobalEmbeddingModelId()
    const provider = await this.config.getProviderInstance()
    if (!provider) return

    const aiModel = provider.getEmbeddingModel(modelId)

    await this.retryEmbed(async () => {
      const { embedding } = await embed({
        model: aiModel,
        value: params.newText
      })

      await this.db.insertEmbedding({
        id: params.entry.embedding_id,
        sourceType: params.entry.source_type,
        sourceId: params.entry.source_id,
        groupId: params.entry.group_id,
        chunkIndex: params.entry.chunk_index,
        chunkText: params.newText,
        metadataJson: params.entry.metadata_json || '{}',
        embedding: this.normalize(embedding),
        modelId
      })
    }, `updateMemoryChunk ${params.entry.embedding_id}`)
  }

  public async embedText(params: {
    text: string
    sourceType: string
    sourceId: string
    groupId: string
    metadataJson?: string
    sourceCreatedAt?: number
    chunkPrefix?: string
  }): Promise<void> {
    if (!this.isConfigured || !params.text.trim()) return

    try {
      const modelId = this.config.getGlobalEmbeddingModelId()
      const provider = await this.config.getProviderInstance()
      if (!provider) return

      const aiModel = provider.getEmbeddingModel(modelId)

      const currentDim = await this.detectDimension()
      if (currentDim > 0) {
        await this.db.initVectorIndex(currentDim)
      }

      const chunks = this.splitIntoChunks(params.text)

      const futures: Promise<void>[] = []

      for (const chunk of chunks) {
        const embeddingInput = params.chunkPrefix
          ? `${params.chunkPrefix}${chunk.text}`
          : chunk.text

        const future = this.retryEmbed(async () => {
          const { embedding } = await embed({
            model: aiModel,
            value: embeddingInput
          })

          await this.db.insertEmbedding({
            id: uuidv4(),
            sourceType: params.sourceType,
            sourceId: params.sourceId,
            groupId: params.groupId,
            chunkIndex: chunk.index,
            chunkText: embeddingInput,
            metadataJson: params.metadataJson || '{}',
            embedding: this.normalize(embedding),
            modelId,
            sourceCreatedAt: params.sourceCreatedAt
          })
        }, `embedText chunk ${chunk.index}`)

        futures.push(future)

        if (futures.length >= 3) {
          await Promise.all(futures)
          futures.length = 0
        }
      }

      if (futures.length > 0) {
        await Promise.all(futures)
      }
    } catch (e) {
      logger.error('embedText failed', { error: e })
      throw e
    }
  }

  public async reEmbedText(params: {
    text: string
    sourceType: string
    sourceId: string
    groupId: string
    metadataJson?: string
    sourceCreatedAt?: number
    chunkPrefix?: string
  }): Promise<void> {
    await this.db.deleteEmbeddingsBySource(params.sourceType, params.sourceId)
    await this.embedText(params)
  }

  public async reEmbedMessage(params: {
    messageId: string
    sessionId: string
    content: string
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

  public async *migrateEmbeddings(): AsyncGenerator<MigrationProgress, void, unknown> {
    yield* runMigrateEmbeddings(this.migrationDeps(), this.migrationRef)
  }

  public async *continueMigration(): AsyncGenerator<MigrationProgress, void, unknown> {
    yield* runContinueMigration(this.migrationDeps(), this.migrationRef)
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
      retryEmbed: (action, label) => this.retryEmbed(action, label)
    }
  }

  private async retryEmbed(
    action: () => Promise<void>,
    label: string = '',
    maxAttempts = 3
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await action()
        return
      } catch (error) {
        if (attempt < maxAttempts) {
          const delayMs = attempt * 1000
          logger.warn(
            `${label} fallback (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms:`,
            { error }
          )
          await new Promise((r) => setTimeout(r, delayMs))
        } else {
          logger.error(`${label} failed completely:`, { error })
          throw error
        }
      }
    }
  }
}
