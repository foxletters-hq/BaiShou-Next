import { embed } from 'ai'
import { logger } from '@baishou/shared'
import type { IEmbeddingConfig, IEmbeddingStorage, MigrationProgress } from './embedding.types'
import { normalizeEmbeddingVector } from './embedding-chunk'

export type EmbeddingMigrationDeps = {
  config: IEmbeddingConfig
  db: IEmbeddingStorage
  isConfigured: boolean
  retryEmbed: (action: () => Promise<void>, label?: string) => Promise<void>
}

export async function* migrateEmbeddings(
  deps: EmbeddingMigrationDeps,
  isMigratingRef: { current: boolean }
): AsyncGenerator<MigrationProgress, void, unknown> {
  if (isMigratingRef.current) {
    yield { total: 0, completed: 0, status: '已经有迁移任务在运行' }
    return
  }
  isMigratingRef.current = true
  try {
    if (!deps.isConfigured) {
      yield { total: 0, completed: 0, status: '嵌入模型未配置' }
      return
    }
    const modelId = deps.config.getGlobalEmbeddingModelId()
    const provider = await deps.config.getProviderInstance()
    if (!provider) {
      yield { total: 0, completed: 0, status: '供应商未找到' }
      return
    }

    const clientModel = provider.getEmbeddingModel(modelId)
    yield { total: 0, completed: 0, status: '正在备份元数据...' }
    const total = await deps.db.createMigrationBackup()

    if (total === 0) {
      await deps.db.dropMigrationBackup()
      yield { total: 0, completed: 0, status: '没有需要迁移的数据' }
      return
    }

    yield { total, completed: 0, status: '正在检测新模型维度...' }
    let newDimension = 0
    try {
      const { embedding } = await embed({ model: clientModel, value: 'hi' })
      newDimension = embedding.length
    } catch (e) {
      logger.error('Dimension check failed during migration', { error: e })
    }

    if (newDimension <= 0) {
      yield { total, completed: 0, status: '新模型维度检测失败，迁移中止' }
      return
    }

    await deps.db.clearAndReinitEmbeddings(newDimension)
    await deps.config.setGlobalEmbeddingDimension(newDimension)

    yield* reEmbedFromBackup(deps, clientModel, modelId, total)
  } finally {
    isMigratingRef.current = false
  }
}

export async function* continueMigration(
  deps: EmbeddingMigrationDeps,
  isMigratingRef: { current: boolean }
): AsyncGenerator<MigrationProgress, void, unknown> {
  if (isMigratingRef.current) {
    yield { total: 0, completed: 0, status: '已经有迁移任务在运行' }
    return
  }
  isMigratingRef.current = true
  try {
    if (!deps.isConfigured) {
      yield { total: 0, completed: 0, status: '嵌入模型未配置' }
      return
    }
    const modelId = deps.config.getGlobalEmbeddingModelId()
    const provider = await deps.config.getProviderInstance()
    if (!provider) {
      yield { total: 0, completed: 0, status: '供应商未找到' }
      return
    }

    const clientModel = provider.getEmbeddingModel(modelId)
    const remaining = await deps.db.getUnmigratedCount()

    if (remaining === 0) {
      await deps.db.dropMigrationBackup()
      yield { total: 0, completed: 0, status: '迁移已完成' }
      return
    }

    yield* reEmbedFromBackup(deps, clientModel, modelId, remaining)
  } finally {
    isMigratingRef.current = false
  }
}

async function* reEmbedFromBackup(
  deps: EmbeddingMigrationDeps,
  aiModel: any,
  modelId: string,
  total: number
): AsyncGenerator<MigrationProgress, void, unknown> {
  yield { total, completed: 0, status: '开始重嵌入...' }

  const chunks = await deps.db.getUnmigratedBackupChunks()
  let completed = 0
  let failed = 0

  for (const chunk of chunks) {
    try {
      await deps.retryEmbed(async () => {
        const { embedding } = await embed({
          model: aiModel,
          value: chunk.chunk_text
        })

        await deps.db.insertEmbedding({
          id: chunk.embedding_id,
          sourceType: chunk.source_type,
          sourceId: chunk.source_id,
          groupId: chunk.group_id,
          chunkIndex: chunk.chunk_index,
          chunkText: chunk.chunk_text,
          metadataJson: chunk.metadata_json,
          embedding: normalizeEmbeddingVector(embedding),
          modelId,
          sourceCreatedAt: chunk.source_created_at
        })

        await deps.db.markBackupChunkMigrated(chunk.embedding_id)
      }, `migrate chunk ${chunk.embedding_id}`)
      completed++
    } catch (e) {
      failed++
      logger.error(`Migration failed for chunk ${chunk.embedding_id}`, { error: e })
    }

    yield {
      total,
      completed,
      failed,
      status: `迁移中 ${completed}/${total}${failed > 0 ? ` (失败 ${failed})` : ''}`
    }
  }

  const [allMigrated, noStale] = await deps.db.verifyMigrationComplete(modelId)

  if (allMigrated && noStale) {
    await deps.db.dropMigrationBackup()
    yield {
      total,
      completed,
      failed,
      status: `迁移完成 ✅ ${completed}/${total}`
    }
  } else {
    yield {
      total,
      completed,
      failed,
      status: `迁移完成但校验未通过 ⚠️${!allMigrated ? ' (部分 chunk 未迁移)' : ''}${!noStale ? ' (存在旧模型数据)' : ''}`
    }
  }
}
