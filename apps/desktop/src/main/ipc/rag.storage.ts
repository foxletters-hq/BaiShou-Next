import { IEmbeddingStorage } from '@baishou/ai'
import { embedLedgerTable, memoryEmbeddingsTable } from '@baishou/database-desktop'
import type {
  EmbedLedgerFailureParams,
  EmbedLedgerReconcileParams,
  EmbedLedgerReconcileResult,
  EmbedLedgerRecordParams,
  RagVectorKind
} from '@baishou/shared'
import { logger, normalizeUnixToSeconds } from '@baishou/shared'
import { eq, and, or, sql } from 'drizzle-orm'
import { getAppDb } from '../db'
import {
  backupBeforeClear,
  createMigrationBackup,
  createRollbackSnapshot,
  deleteSafetyBackup,
  dropMigrationBackup,
  dropRollbackSnapshot,
  exportEmbeddings,
  getUnmigratedBackupChunks,
  getUnmigratedCount,
  hasMigrationBackupTable,
  hasMigrationRollbackTable,
  hasPendingMigration,
  hasRollbackSnapshot,
  listSafetyBackups,
  markBackupChunkMigrated,
  restoreFromSafetyBackup,
  restoreRollbackSnapshot
} from './rag-storage-backup'
import {
  listLedgerBySource,
  rebuildEmbedLedger,
  reconcileEmbedLedger,
  recordEmbedFailure,
  recordEmbedded
} from './rag-storage-ledger'
import { embeddingKindFilter, withEmbeddingWriteLock } from './rag-storage.util'

export class DesktopEmbeddingStorage implements IEmbeddingStorage {
  async initVectorIndex(_dimension: number): Promise<void> {
    // Drizzle 迁移已管理 memory_embeddings 表结构，此处无需额外操作
  }

  async insertEmbedding(params: {
    id: string
    sourceType: string
    sourceId: string
    groupId: string
    vaultId: string
    chunkIndex: number
    chunkText: string
    metadataJson?: string
    embedding: number[]
    modelId: string
    sourceCreatedAt?: number
  }): Promise<void> {
    await withEmbeddingWriteLock(async () => {
      const db = getAppDb()
      const vaultId = params.vaultId.trim()
      if (!vaultId) {
        throw new Error('insertEmbedding: vaultId is required')
      }
      const vectorBuffer = Buffer.from(new Float32Array(params.embedding).buffer)

      await db
        .insert(memoryEmbeddingsTable)
        .values({
          embeddingId: params.id,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          groupId: params.groupId,
          vaultId,
          chunkIndex: params.chunkIndex,
          chunkText: params.chunkText,
          metadataJson: params.metadataJson || '{}',
          embedding: vectorBuffer,
          dimension: params.embedding.length,
          modelId: params.modelId,
          createdAt: new Date(),
          sourceCreatedAt: new Date(
            normalizeUnixToSeconds(params.sourceCreatedAt ?? Date.now()) * 1000
          )
        })
        .onConflictDoUpdate({
          target: [memoryEmbeddingsTable.embeddingId],
          set: {
            chunkText: params.chunkText,
            embedding: vectorBuffer,
            dimension: params.embedding.length,
            modelId: params.modelId,
            metadataJson: params.metadataJson || '{}',
            vaultId,
            groupId: params.groupId,
            sourceCreatedAt: new Date(
              normalizeUnixToSeconds(params.sourceCreatedAt ?? Date.now()) * 1000
            )
          }
        })
    })
  }

  async deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void> {
    await withEmbeddingWriteLock(async () => {
      const db = getAppDb()
      await db
        .delete(memoryEmbeddingsTable)
        .where(
          and(
            eq(memoryEmbeddingsTable.sourceType, sourceType),
            eq(memoryEmbeddingsTable.sourceId, sourceId)
          )
        )
      try {
        await db
          .delete(embedLedgerTable)
          .where(
            and(
              eq(embedLedgerTable.sourceType, sourceType),
              eq(embedLedgerTable.sourceId, sourceId)
            )
          )
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        logger.warn('[RAG] 删除 embed_ledger 行失败（非阻塞）:', message)
      }
    })
  }

  async replaceSourceEmbeddings(params: {
    vaultId: string
    sourceType: string
    sourceId: string
    groupId: string
    modelId: string
    dimension: number
    contentHash: string
    metadataJson?: string
    sourceCreatedAt?: number
    replaceExisting?: boolean
    recordLedger?: boolean
    chunks: Array<{
      id: string
      chunkIndex: number
      chunkText: string
      embedding: number[]
    }>
  }): Promise<void> {
    await withEmbeddingWriteLock(async () => {
      const db = getAppDb()
      const vaultId = params.vaultId.trim()
      if (!vaultId) {
        throw new Error('replaceSourceEmbeddings: vaultId is required')
      }
      const now = Date.now()
      const createdAtDate = new Date(now)
      const sourceCreatedAtDate = new Date(
        normalizeUnixToSeconds(params.sourceCreatedAt ?? now) * 1000
      )
      const metadataJson = params.metadataJson || '{}'

      await db.run(sql.raw('SAVEPOINT rag_replace_source_sp'))
      try {
        if (params.replaceExisting) {
          await db
            .delete(memoryEmbeddingsTable)
            .where(
              and(
                eq(memoryEmbeddingsTable.sourceType, params.sourceType),
                eq(memoryEmbeddingsTable.sourceId, params.sourceId)
              )
            )
        }

        const BATCH_SIZE = 50
        for (let i = 0; i < params.chunks.length; i += BATCH_SIZE) {
          const slice = params.chunks.slice(i, i + BATCH_SIZE)
          await db
            .insert(memoryEmbeddingsTable)
            .values(
              slice.map((chunk) => ({
                embeddingId: chunk.id,
                sourceType: params.sourceType,
                sourceId: params.sourceId,
                groupId: params.groupId,
                vaultId,
                chunkIndex: chunk.chunkIndex,
                chunkText: chunk.chunkText,
                metadataJson,
                embedding: Buffer.from(new Float32Array(chunk.embedding).buffer),
                dimension: chunk.embedding.length,
                modelId: params.modelId,
                createdAt: createdAtDate,
                sourceCreatedAt: sourceCreatedAtDate
              }))
            )
            .onConflictDoUpdate({
              target: [memoryEmbeddingsTable.embeddingId],
              set: {
                chunkText: sql`excluded.chunk_text`,
                embedding: sql`excluded.embedding`,
                dimension: sql`excluded.dimension`,
                modelId: sql`excluded.model_id`,
                metadataJson: sql`excluded.metadata_json`,
                vaultId: sql`excluded.vault_id`,
                groupId: sql`excluded.group_id`,
                sourceCreatedAt: sql`excluded.source_created_at`
              }
            })
        }

        if (params.recordLedger) {
          await db
            .insert(embedLedgerTable)
            .values({
              vaultId,
              sourceType: params.sourceType,
              sourceId: params.sourceId,
              contentHash: params.contentHash,
              chunkCount: params.chunks.length,
              modelId: params.modelId,
              dimension: params.dimension,
              status: 'embedded',
              attempts: 0,
              lastError: null,
              embeddedAt: now,
              updatedAt: now
            })
            .onConflictDoUpdate({
              target: [
                embedLedgerTable.vaultId,
                embedLedgerTable.sourceType,
                embedLedgerTable.sourceId
              ],
              set: {
                contentHash: params.contentHash,
                chunkCount: params.chunks.length,
                modelId: params.modelId,
                dimension: params.dimension,
                status: 'embedded',
                attempts: 0,
                lastError: null,
                embeddedAt: now,
                updatedAt: now
              }
            })
        }

        await db.run(sql.raw('RELEASE rag_replace_source_sp'))
      } catch (e) {
        try {
          await db.run(sql.raw('ROLLBACK TO rag_replace_source_sp'))
          await db.run(sql.raw('RELEASE rag_replace_source_sp'))
        } catch {
          // ignore
        }
        throw e
      }
    })
  }

  async listLedgerBySource(
    sourceType: string,
    options?: { vaultId?: string }
  ): Promise<Array<{ sourceId: string; contentHash: string; status: string }>> {
    return listLedgerBySource(sourceType, options)
  }

  async recordEmbedded(params: EmbedLedgerRecordParams): Promise<void> {
    return recordEmbedded(params)
  }

  async reconcileEmbedLedger(
    params?: EmbedLedgerReconcileParams
  ): Promise<EmbedLedgerReconcileResult> {
    return reconcileEmbedLedger(params)
  }

  async rebuildEmbedLedger(params?: EmbedLedgerReconcileParams): Promise<void> {
    return rebuildEmbedLedger(params)
  }

  async recordEmbedFailure(params: EmbedLedgerFailureParams): Promise<void> {
    return recordEmbedFailure(params)
  }

  async countEmbeddings(): Promise<number> {
    const db = getAppDb()
    const countRows = await db.all(sql`SELECT count(*) as c FROM memory_embeddings`)
    return Number((countRows[0] as { c?: number } | undefined)?.c ?? 0)
  }

  async clearEmbeddingsByKinds(kinds: RagVectorKind[]): Promise<void> {
    const unique = [...new Set(kinds)]
    if (unique.length === 0) return
    if (unique.length === 4) {
      await this.clearEmbeddings()
      return
    }
    const filters = unique.map((kind) => embeddingKindFilter(kind))
    const db = getAppDb()
    await db.delete(memoryEmbeddingsTable).where(or(...filters))
    try {
      await db.run(sql`
        DELETE FROM embed_ledger
        WHERE NOT EXISTS (
          SELECT 1 FROM memory_embeddings e
          WHERE e.vault_id = embed_ledger.vault_id
            AND e.source_type = embed_ledger.source_type
            AND e.source_id = embed_ledger.source_id
        )
      `)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('[RAG] 按类型清空后修剪 embed_ledger 失败（非阻塞）:', message)
    }
  }

  async clearEmbeddings(): Promise<void> {
    const db = getAppDb()
    await db.delete(memoryEmbeddingsTable)
    // 账本必须跟着清，否则清空后账本仍声称全部已嵌入，要等下一次计数自检才纠正，
    // 而那一次纠正是整本账的全量重建。
    try {
      await db.delete(embedLedgerTable)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('[RAG] 清空 embed_ledger 失败（非阻塞）:', message)
    }
  }

  async backupBeforeClear(): Promise<number> {
    return backupBeforeClear()
  }

  async listSafetyBackups(): Promise<Array<{ name: string; count: number; createdAt: string }>> {
    return listSafetyBackups()
  }

  async restoreFromSafetyBackup(backupTableName: string): Promise<number> {
    return restoreFromSafetyBackup(backupTableName)
  }

  async deleteSafetyBackup(backupTableName: string): Promise<void> {
    return deleteSafetyBackup(backupTableName)
  }

  async exportEmbeddings(): Promise<any[]> {
    return exportEmbeddings()
  }

  async hasPendingMigration(): Promise<boolean> {
    return hasPendingMigration()
  }

  async hasMigrationBackupTable(): Promise<boolean> {
    return hasMigrationBackupTable()
  }

  async hasMigrationRollbackTable(): Promise<boolean> {
    return hasMigrationRollbackTable()
  }

  async countHeterogeneousEmbeddings(currentModelId: string): Promise<number> {
    const db = getAppDb()
    const checkTable = await db.all(
      sql`SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'`
    )
    if (checkTable.length === 0) return 0

    const countRows = await db.all(
      sql`SELECT count(*) as c FROM memory_embeddings WHERE model_id != ${currentModelId}`
    )
    return Number((countRows[0] as any)?.c ?? 0)
  }

  async getCurrentEmbeddingMeta(): Promise<{
    modelId: string
    dimension: number
    count: number
  } | null> {
    const db = getAppDb()
    const countRows = await db.all(sql`SELECT count(*) as c FROM memory_embeddings`)
    const count = Number((countRows[0] as any)?.c ?? 0)
    if (count === 0) return null

    const metaRows = await db.all(sql`
      SELECT model_id as modelId, dimension, count(*) as c
      FROM memory_embeddings
      GROUP BY model_id, dimension
      ORDER BY c DESC
      LIMIT 1
    `)
    const row = metaRows[0] as any
    if (!row?.modelId) return null

    return {
      modelId: String(row.modelId),
      dimension: Number(row.dimension ?? 0),
      count
    }
  }

  async createRollbackSnapshot(): Promise<number> {
    return createRollbackSnapshot()
  }

  async restoreRollbackSnapshot(): Promise<number> {
    return restoreRollbackSnapshot()
  }

  async dropRollbackSnapshot(): Promise<void> {
    return dropRollbackSnapshot()
  }

  async hasRollbackSnapshot(): Promise<boolean> {
    return hasRollbackSnapshot()
  }

  async createMigrationBackup(): Promise<number> {
    return createMigrationBackup()
  }

  async dropMigrationBackup(): Promise<void> {
    return dropMigrationBackup()
  }

  async clearAndReinitEmbeddings(_dimension: number): Promise<void> {
    await this.clearEmbeddings()
  }

  async getUnmigratedCount(): Promise<number> {
    return getUnmigratedCount()
  }

  async getUnmigratedBackupChunks(): Promise<any[]> {
    return getUnmigratedBackupChunks()
  }

  async markBackupChunkMigrated(embeddingId: string): Promise<void> {
    return markBackupChunkMigrated(embeddingId)
  }

  async verifyMigrationComplete(modelId: string): Promise<[boolean, boolean]> {
    const pending = await this.hasPendingMigration()
    const mismatchedCount = await this.countHeterogeneousEmbeddings(modelId)
    return [!pending, mismatchedCount === 0]
  }
}
