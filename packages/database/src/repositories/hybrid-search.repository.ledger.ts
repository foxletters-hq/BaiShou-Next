import {
  aggregateEmbedLedgerFromVectorRows,
  EMBED_LEDGER_REBUILD_SAVEPOINT,
  finishEmbedLedgerRebuild,
  type AggregatedEmbedLedgerRow,
  type EmbedLedgerVectorRow
} from '@baishou/shared'
import type {
  ISqlExecutor,
  EmbedLedgerFailureParams,
  EmbedLedgerReconcileParams,
  EmbedLedgerReconcileResult,
  EmbedLedgerRecordParams
} from '@baishou/shared'
import {
  buildEmbedLedgerScopeClause,
  EMBED_LEDGER_TABLE,
  HYBRID_SEARCH_TABLE
} from './hybrid-search.repository.constants'

export class HybridSearchLedgerStore {
  constructor(private readonly db: ISqlExecutor) {}

  async listLedgerBySource(
    sourceType: string,
    options?: { vaultId?: string }
  ): Promise<Array<{ sourceId: string; contentHash: string; status: string }>> {
    const conditions = ['source_type = ?']
    const args: Array<string | number> = [sourceType]
    const vaultId = options?.vaultId?.trim()
    if (vaultId) {
      conditions.push('vault_id = ?')
      args.push(vaultId)
    }
    const result = await this.db.execute({
      sql: `
        SELECT source_id AS sourceId, content_hash AS contentHash, status
        FROM ${EMBED_LEDGER_TABLE}
        WHERE ${conditions.join(' AND ')}
      `,
      args
    })
    return result.rows.map((raw) => {
      const row = raw as Record<string, unknown>
      return {
        sourceId: String(row.sourceId ?? row.source_id ?? ''),
        contentHash: String(row.contentHash ?? row.content_hash ?? ''),
        status: String(row.status ?? '')
      }
    })
  }

  async recordEmbedded(params: EmbedLedgerRecordParams): Promise<void> {
    const vaultId = params.vaultId.trim()
    if (!vaultId) {
      throw new Error('recordEmbedded: vaultId is required')
    }
    const now = Date.now()
    await this.db.execute({
      sql: `
        INSERT INTO ${EMBED_LEDGER_TABLE}
        (vault_id, source_type, source_id, content_hash, chunk_count,
         model_id, dimension, status, attempts, last_error, embedded_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'embedded', 0, NULL, ?, ?)
        ON CONFLICT(vault_id, source_type, source_id) DO UPDATE SET
          content_hash = excluded.content_hash,
          chunk_count = excluded.chunk_count,
          model_id = excluded.model_id,
          dimension = excluded.dimension,
          status = 'embedded',
          attempts = 0,
          last_error = NULL,
          embedded_at = excluded.embedded_at,
          updated_at = excluded.updated_at
      `,
      args: [
        vaultId,
        params.sourceType,
        params.sourceId,
        params.contentHash,
        params.chunkCount,
        params.modelId,
        params.dimension,
        now,
        now
      ]
    })
  }

  async reconcileEmbedLedger(
    params?: EmbedLedgerReconcileParams
  ): Promise<EmbedLedgerReconcileResult> {
    const { ledgerChunkSum, vectorCount, mismatch } = await this.readEmbedLedgerCountGap(params)
    if (!mismatch) {
      return { rebuilt: false, ledgerChunkSum, vectorCount }
    }
    await this.rebuildEmbedLedger(params)
    return { rebuilt: true, ledgerChunkSum, vectorCount }
  }

  async rebuildEmbedLedger(params?: EmbedLedgerReconcileParams): Promise<void> {
    await this.rebuildEmbedLedgerRows(params)
    await finishEmbedLedgerRebuild(params?.onRebuilt)
  }

  private async rebuildEmbedLedgerRows(params?: EmbedLedgerReconcileParams): Promise<void> {
    const { clause, args } = buildEmbedLedgerScopeClause(params)
    const vectorResult = await this.db.execute({
      sql: `
        SELECT vault_id AS vaultId, source_type AS sourceType, source_id AS sourceId,
               model_id AS modelId, dimension, metadata_json AS metadataJson
        FROM ${HYBRID_SEARCH_TABLE}
        WHERE ${clause}
      `,
      args
    })
    const vectorRows: EmbedLedgerVectorRow[] = vectorResult.rows.map((raw) => {
      const row = raw as Record<string, unknown>
      return {
        vaultId: String(row.vaultId ?? row.vault_id ?? ''),
        sourceType: String(row.sourceType ?? row.source_type ?? ''),
        sourceId: String(row.sourceId ?? row.source_id ?? ''),
        modelId: String(row.modelId ?? row.model_id ?? ''),
        dimension: Number(row.dimension ?? 0),
        metadataJson: String(row.metadataJson ?? row.metadata_json ?? '{}')
      }
    })

    const zeroResult = await this.db.execute({
      sql: `
        SELECT vault_id AS vaultId, source_type AS sourceType, source_id AS sourceId,
               content_hash AS contentHash, model_id AS modelId, dimension, updated_at AS updatedAt
        FROM ${EMBED_LEDGER_TABLE}
        WHERE ${clause} AND status = 'embedded' AND chunk_count = 0
      `,
      args
    })
    const zeroRows: AggregatedEmbedLedgerRow[] = zeroResult.rows.map((raw) => {
      const row = raw as Record<string, unknown>
      return {
        vaultId: String(row.vaultId ?? row.vault_id ?? ''),
        sourceType: String(row.sourceType ?? row.source_type ?? ''),
        sourceId: String(row.sourceId ?? row.source_id ?? ''),
        contentHash: String(row.contentHash ?? row.content_hash ?? ''),
        chunkCount: 0,
        modelId: String(row.modelId ?? row.model_id ?? ''),
        dimension: Number(row.dimension ?? 0),
        updatedAt: Number(row.updatedAt ?? row.updated_at ?? 0)
      }
    })

    const aggregated = aggregateEmbedLedgerFromVectorRows(vectorRows)
    const seen = new Set(
      aggregated.map((row) => `${row.vaultId}\0${row.sourceType}\0${row.sourceId}`)
    )
    const pending = aggregated.concat(
      zeroRows.filter((row) => !seen.has(`${row.vaultId}\0${row.sourceType}\0${row.sourceId}`))
    )

    // 整本账要么全换成新的，要么原样不动：中途崩溃留下「删完了但只插了一半」的账本，
    // 虽然下一次自检还会再纠正，但那一轮的待嵌入计数会偏小、提醒会漏报。
    await this.db.execute(`SAVEPOINT ${EMBED_LEDGER_REBUILD_SAVEPOINT}`)
    try {
      await this.db.execute({
        sql: `DELETE FROM ${EMBED_LEDGER_TABLE} WHERE ${clause}`,
        args
      })
      for (const row of pending) {
        await this.insertRebuiltLedgerRow(row)
      }
      await this.db.execute(`RELEASE ${EMBED_LEDGER_REBUILD_SAVEPOINT}`)
    } catch (e) {
      await this.db.execute(`ROLLBACK TO ${EMBED_LEDGER_REBUILD_SAVEPOINT}`).catch(() => undefined)
      await this.db.execute(`RELEASE ${EMBED_LEDGER_REBUILD_SAVEPOINT}`).catch(() => undefined)
      throw e
    }
  }

  private async readEmbedLedgerCountGap(params?: EmbedLedgerReconcileParams): Promise<{
    ledgerChunkSum: number
    vectorCount: number
    mismatch: boolean
  }> {
    const { clause, args } = buildEmbedLedgerScopeClause(params)
    const ledgerResult = await this.db.execute({
      sql: `
        SELECT vault_id AS vaultId, source_type AS sourceType,
               COALESCE(SUM(chunk_count), 0) AS chunkSum
        FROM ${EMBED_LEDGER_TABLE}
        WHERE ${clause}
        GROUP BY vault_id, source_type
      `,
      args
    })
    const vectorResult = await this.db.execute({
      sql: `
        SELECT vault_id AS vaultId, source_type AS sourceType, COUNT(*) AS vectorCount
        FROM ${HYBRID_SEARCH_TABLE}
        WHERE ${clause}
        GROUP BY vault_id, source_type
      `,
      args
    })

    const ledgerMap = new Map<string, number>()
    for (const raw of ledgerResult.rows) {
      const row = raw as Record<string, unknown>
      const key = `${String(row.vaultId ?? row.vault_id ?? '')}\0${String(row.sourceType ?? row.source_type ?? '')}`
      ledgerMap.set(key, Number(row.chunkSum ?? row.chunk_sum ?? 0))
    }
    const vectorMap = new Map<string, number>()
    for (const raw of vectorResult.rows) {
      const row = raw as Record<string, unknown>
      const key = `${String(row.vaultId ?? row.vault_id ?? '')}\0${String(row.sourceType ?? row.source_type ?? '')}`
      vectorMap.set(key, Number(row.vectorCount ?? row.vector_count ?? row.c ?? 0))
    }

    const keys = new Set([...ledgerMap.keys(), ...vectorMap.keys()])
    let ledgerChunkSum = 0
    let vectorCount = 0
    let mismatch = false
    for (const key of keys) {
      const sum = ledgerMap.get(key) ?? 0
      const count = vectorMap.get(key) ?? 0
      ledgerChunkSum += sum
      vectorCount += count
      if (sum !== count) mismatch = true
    }
    return { ledgerChunkSum, vectorCount, mismatch }
  }

  private async insertRebuiltLedgerRow(row: AggregatedEmbedLedgerRow): Promise<void> {
    const now = Date.now()
    const stamp = row.updatedAt > 0 ? row.updatedAt : now
    await this.db.execute({
      sql: `
        INSERT INTO ${EMBED_LEDGER_TABLE}
        (vault_id, source_type, source_id, content_hash, chunk_count,
         model_id, dimension, status, attempts, last_error, embedded_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'embedded', 0, NULL, ?, ?)
        ON CONFLICT(vault_id, source_type, source_id) DO UPDATE SET
          content_hash = excluded.content_hash,
          chunk_count = excluded.chunk_count,
          model_id = excluded.model_id,
          dimension = excluded.dimension,
          status = 'embedded',
          attempts = 0,
          last_error = NULL,
          embedded_at = excluded.embedded_at,
          updated_at = excluded.updated_at
      `,
      args: [
        row.vaultId,
        row.sourceType,
        row.sourceId,
        row.contentHash,
        row.chunkCount,
        row.modelId,
        row.dimension,
        stamp,
        stamp
      ]
    })
  }

  async recordEmbedFailure(params: EmbedLedgerFailureParams): Promise<void> {
    const vaultId = params.vaultId.trim()
    if (!vaultId) {
      throw new Error('recordEmbedFailure: vaultId is required')
    }
    const now = Date.now()
    await this.db.execute({
      sql: `
        INSERT INTO ${EMBED_LEDGER_TABLE}
        (vault_id, source_type, source_id, content_hash, chunk_count,
         model_id, dimension, status, attempts, last_error, embedded_at, updated_at)
        VALUES (?, ?, ?, '', 0, '', 0, 'failed', 1, ?, NULL, ?)
        ON CONFLICT(vault_id, source_type, source_id) DO UPDATE SET
          status = 'failed',
          attempts = attempts + 1,
          last_error = excluded.last_error,
          updated_at = excluded.updated_at
      `,
      args: [vaultId, params.sourceType, params.sourceId, params.lastError, now]
    })
  }
}
