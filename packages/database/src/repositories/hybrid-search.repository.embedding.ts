import { embeddingVectorToBytes, logger, MEMORY_EMBED_GROUP_ID } from '@baishou/shared'
import type {
  ISqlExecutor,
  EmbedLedgerFailureParams,
  EmbedLedgerReconcileParams,
  EmbedLedgerRecordParams
} from '@baishou/shared'
import {
  EMBED_LEDGER_TABLE,
  HYBRID_SEARCH_INDEX_NAME,
  HYBRID_SEARCH_TABLE
} from './hybrid-search.repository.constants'
import { HybridSearchLedgerStore } from './hybrid-search.repository.ledger'

export { HybridSearchMigrationStore } from './hybrid-search.repository.migration'

export class HybridSearchEmbeddingStore {
  private readonly ledger: HybridSearchLedgerStore

  constructor(private readonly db: ISqlExecutor) {
    this.ledger = new HybridSearchLedgerStore(db)
  }

  async initVectorIndex(dimension: number): Promise<void> {
    await this.initVectorTables(dimension, false)
  }

  async initVectorTables(dimension: number, _forceRebuild = false): Promise<void> {
    if (dimension <= 0) return

    try {
      await this.db.execute('SELECT vec_version()')
      logger.info(`[VectorSearch] sqlite-vec 已就绪（dim=${dimension}, metric=cosine）`)
      return
    } catch {
      // 非 sqlite-vec 环境，尝试 libsql 专有 ANN 索引
    }

    try {
      await this.db.execute(
        `CREATE INDEX IF NOT EXISTS ${HYBRID_SEARCH_INDEX_NAME} ON ${HYBRID_SEARCH_TABLE} (libsql_vector_idx(embedding, 'metric=cosine'))`
      )
      logger.info(`[VectorSearch] libsql ANN 索引已就绪（dim=${dimension}, metric=cosine）`)
    } catch (e: any) {
      logger.warn('[VectorSearch] ANN 索引创建失败（将使用降级搜索）:', e.message)
    }
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
    const vaultId = params.vaultId.trim()
    if (!vaultId) {
      throw new Error('insertEmbedding: vaultId is required')
    }
    const vectorBuffer = embeddingVectorToBytes(params.embedding)
    await this.db.execute({
      sql: `
        INSERT INTO ${HYBRID_SEARCH_TABLE}
        (embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
         metadata_json, embedding, dimension, model_id, created_at, source_created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(embedding_id) DO UPDATE SET
          chunk_text = excluded.chunk_text,
          embedding = excluded.embedding,
          dimension = excluded.dimension,
          model_id = excluded.model_id,
          metadata_json = excluded.metadata_json,
          vault_id = excluded.vault_id,
          group_id = excluded.group_id
      `,
      args: [
        params.id,
        params.sourceType,
        params.sourceId,
        params.groupId,
        vaultId,
        params.chunkIndex,
        params.chunkText,
        params.metadataJson || '{}',
        vectorBuffer,
        params.embedding.length,
        params.modelId,
        Math.floor(Date.now() / 1000),
        (() => {
          const srcVal = params.sourceCreatedAt || Date.now()
          return srcVal > 100000000000 ? Math.floor(srcVal / 1000) : srcVal
        })()
      ]
    })
  }

  async deleteEmbeddingsBySource(sourceType: string, sourceId: string): Promise<void> {
    await this.db.execute({
      sql: `DELETE FROM ${HYBRID_SEARCH_TABLE} WHERE source_type = ? AND source_id = ?`,
      args: [sourceType, sourceId]
    })
    try {
      await this.db.execute({
        sql: `DELETE FROM ${EMBED_LEDGER_TABLE} WHERE source_type = ? AND source_id = ?`,
        args: [sourceType, sourceId]
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('[VectorSearch] 删除 embed_ledger 行失败（非阻塞）:', message)
    }
  }

  listLedgerBySource(...args: Parameters<HybridSearchLedgerStore['listLedgerBySource']>) {
    return this.ledger.listLedgerBySource(...args)
  }

  recordEmbedded(params: EmbedLedgerRecordParams) {
    return this.ledger.recordEmbedded(params)
  }

  reconcileEmbedLedger(params?: EmbedLedgerReconcileParams) {
    return this.ledger.reconcileEmbedLedger(params)
  }

  rebuildEmbedLedger(params?: EmbedLedgerReconcileParams) {
    return this.ledger.rebuildEmbedLedger(params)
  }

  recordEmbedFailure(params: EmbedLedgerFailureParams) {
    return this.ledger.recordEmbedFailure(params)
  }

  /** 按来源类型 + 唯一键读取一条嵌入。未传 vaultId 时 fail-closed。 */
  async getBySource(
    sourceType: string,
    sourceId: string,
    options?: { vaultId?: string }
  ): Promise<{
    sourceType: string
    sourceId: string
    chunkText: string
    createdAt: number | null
  } | null> {
    const vaultId = options?.vaultId?.trim()
    if (!vaultId) return null
    const trimmedType = sourceType.trim()
    const trimmedId = sourceId.trim()
    if (!trimmedType || !trimmedId) return null

    const result = await this.db.execute({
      sql: `
        SELECT source_type, source_id, chunk_text, source_created_at
        FROM ${HYBRID_SEARCH_TABLE}
        WHERE source_type = ? AND source_id = ? AND vault_id = ?
        ORDER BY chunk_index ASC
        LIMIT 1
      `,
      args: [trimmedType, trimmedId, vaultId]
    })
    const row = result.rows[0] as Record<string, unknown> | undefined
    if (!row) return null

    const srcAt = row.source_created_at
    let createdAt: number | null = null
    if (typeof srcAt === 'number') {
      createdAt = srcAt > 1e12 ? srcAt : srcAt * 1000
    }
    return {
      sourceType: String(row.source_type ?? trimmedType),
      sourceId: String(row.source_id ?? trimmedId),
      chunkText: String(row.chunk_text ?? ''),
      createdAt
    }
  }

  /** Distinct source_id values for a source_type (optionally scoped by group_id / vault_id). */
  async listSourceIdsByType(
    sourceType: string,
    options?: { groupId?: string; vaultId?: string }
  ): Promise<string[]> {
    const conditions = ['source_type = ?']
    const args: (string | number)[] = [sourceType]
    if (options?.groupId) {
      conditions.push('group_id = ?')
      args.push(options.groupId)
    }
    if (options?.vaultId) {
      conditions.push('vault_id = ?')
      args.push(options.vaultId)
    }
    const result = await this.db.execute({
      sql: `SELECT DISTINCT source_id AS source_id FROM ${HYBRID_SEARCH_TABLE} WHERE ${conditions.join(' AND ')}`,
      args
    })
    return result.rows
      .map((row) => String((row as { source_id?: unknown }).source_id ?? ''))
      .filter((id) => id.length > 0)
  }

  /** Chunk rows for a source_type (backfill Memory JSONL from legacy chat/mem_*). */
  async listEmbeddingChunksByType(
    sourceType: string,
    options?: { vaultId?: string }
  ): Promise<
    Array<{
      sourceId: string
      chunkText: string
      groupId: string
      chunkIndex: number
      sourceCreatedAt: number | null
    }>
  > {
    const vaultId = options?.vaultId?.trim()
    // 未传 vaultId → fail-closed，避免冷启动回填把别仓记忆写入本仓 JSONL
    if (!vaultId) {
      return []
    }
    const result = await this.db.execute({
      sql: `
        SELECT source_id, chunk_text, group_id, chunk_index, source_created_at
        FROM ${HYBRID_SEARCH_TABLE}
        WHERE source_type = ? AND vault_id = ?
        ORDER BY source_id, chunk_index
      `,
      args: [sourceType, vaultId]
    })
    return result.rows.map((row) => {
      const r = row as Record<string, unknown>
      const srcAt = r.source_created_at
      let sourceCreatedAt: number | null = null
      if (typeof srcAt === 'number') {
        sourceCreatedAt = srcAt > 1e12 ? srcAt : srcAt * 1000
      }
      return {
        sourceId: String(r.source_id ?? ''),
        chunkText: String(r.chunk_text ?? ''),
        groupId: String(r.group_id ?? ''),
        chunkIndex: Number(r.chunk_index ?? 0),
        sourceCreatedAt
      }
    })
  }

  /**
   * Flip source_type from manual → memory and align group_id, without re-embedding.
   * Returns number of distinct source_id values that had at least one row updated.
   */
  async normalizeManualToMemory(params: {
    vaultId: string
    sourceIds?: string[]
  }): Promise<number> {
    const groupId = MEMORY_EMBED_GROUP_ID
    const vaultId = params.vaultId.trim()
    if (params.sourceIds && params.sourceIds.length > 0) {
      const placeholders = params.sourceIds.map(() => '?').join(', ')
      const before = await this.db.execute({
        sql: `
          SELECT COUNT(DISTINCT source_id) AS c FROM ${HYBRID_SEARCH_TABLE}
          WHERE source_type = 'manual' AND source_id IN (${placeholders})
        `,
        args: [...params.sourceIds]
      })
      const count = Number((before.rows[0] as { c?: unknown } | undefined)?.c ?? 0)
      if (count === 0) return 0
      await this.db.execute({
        sql: `
          UPDATE ${HYBRID_SEARCH_TABLE}
          SET source_type = 'memory',
              vault_id = CASE
                WHEN vault_id IS NOT NULL AND vault_id != '' THEN vault_id
                ELSE ?
              END,
              group_id = CASE
                WHEN group_id = ? OR group_id LIKE 'memory:%' THEN group_id
                ELSE ?
              END
          WHERE source_type = 'manual' AND source_id IN (${placeholders})
        `,
        args: [vaultId, MEMORY_EMBED_GROUP_ID, groupId, ...params.sourceIds]
      })
      return count
    }

    const before = await this.db.execute({
      sql: `SELECT COUNT(DISTINCT source_id) AS c FROM ${HYBRID_SEARCH_TABLE} WHERE source_type = 'manual'`,
      args: []
    })
    const count = Number((before.rows[0] as { c?: unknown } | undefined)?.c ?? 0)
    if (count === 0) return 0
    await this.db.execute({
      sql: `
        UPDATE ${HYBRID_SEARCH_TABLE}
        SET source_type = 'memory',
            vault_id = CASE
              WHEN vault_id IS NOT NULL AND vault_id != '' THEN vault_id
              ELSE ?
            END,
            group_id = CASE
              WHEN group_id = ? OR group_id LIKE 'memory:%' THEN group_id
              ELSE ?
            END
        WHERE source_type = 'manual'
      `,
      args: [vaultId, MEMORY_EMBED_GROUP_ID, groupId]
    })
    return count
  }

  async updateMetadataBySource(
    sourceType: string,
    sourceId: string,
    metadataJson: string
  ): Promise<void> {
    await this.db.execute({
      sql: `UPDATE ${HYBRID_SEARCH_TABLE} SET metadata_json = ? WHERE source_type = ? AND source_id = ?`,
      args: [metadataJson, sourceType, sourceId]
    })
  }

  async clearEmbeddings(): Promise<void> {
    await this.db.execute(`DELETE FROM ${HYBRID_SEARCH_TABLE}`)
    // 账本必须跟着清，否则清空后账本仍声称全部已嵌入，要等下一次计数自检才纠正，
    // 而那一次纠正是整本账的全量重建。
    try {
      await this.db.execute(`DELETE FROM ${EMBED_LEDGER_TABLE}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('[VectorSearch] 清空 embed_ledger 失败（非阻塞）:', message)
    }
  }

  async clearAndReinitEmbeddings(dimension: number): Promise<void> {
    await this.clearEmbeddings()
    await this.initVectorTables(dimension, false)
  }
}
