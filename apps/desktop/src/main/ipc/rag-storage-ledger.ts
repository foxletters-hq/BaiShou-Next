import { embedLedgerTable } from '@baishou/database-desktop'
import type {
  AggregatedEmbedLedgerRow,
  EmbedLedgerFailureParams,
  EmbedLedgerReconcileParams,
  EmbedLedgerReconcileResult,
  EmbedLedgerRecordParams,
  EmbedLedgerVectorRow
} from '@baishou/shared'
import {
  aggregateEmbedLedgerFromVectorRows,
  EMBED_LEDGER_REBUILD_SAVEPOINT,
  finishEmbedLedgerRebuild
} from '@baishou/shared'
import { eq, and, sql } from 'drizzle-orm'
import { getAppDb } from '../db'
import { withEmbeddingWriteLock } from './rag-storage.util'

export async function listLedgerBySource(
  sourceType: string,
  options?: { vaultId?: string }
): Promise<Array<{ sourceId: string; contentHash: string; status: string }>> {
  const db = getAppDb()
  const vaultId = options?.vaultId?.trim()
  const rows = vaultId
    ? await db
        .select({
          sourceId: embedLedgerTable.sourceId,
          contentHash: embedLedgerTable.contentHash,
          status: embedLedgerTable.status
        })
        .from(embedLedgerTable)
        .where(
          and(eq(embedLedgerTable.sourceType, sourceType), eq(embedLedgerTable.vaultId, vaultId))
        )
    : await db
        .select({
          sourceId: embedLedgerTable.sourceId,
          contentHash: embedLedgerTable.contentHash,
          status: embedLedgerTable.status
        })
        .from(embedLedgerTable)
        .where(eq(embedLedgerTable.sourceType, sourceType))
  return rows.map((row) => ({
    sourceId: row.sourceId,
    contentHash: row.contentHash,
    status: row.status
  }))
}

export async function recordEmbedded(params: EmbedLedgerRecordParams): Promise<void> {
  await withEmbeddingWriteLock(async () => {
    const db = getAppDb()
    const vaultId = params.vaultId.trim()
    if (!vaultId) {
      throw new Error('recordEmbedded: vaultId is required')
    }
    const now = Date.now()
    await db
      .insert(embedLedgerTable)
      .values({
        vaultId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        contentHash: params.contentHash,
        chunkCount: params.chunkCount,
        modelId: params.modelId,
        dimension: params.dimension,
        status: 'embedded',
        attempts: 0,
        lastError: null,
        embeddedAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [embedLedgerTable.vaultId, embedLedgerTable.sourceType, embedLedgerTable.sourceId],
        set: {
          contentHash: params.contentHash,
          chunkCount: params.chunkCount,
          modelId: params.modelId,
          dimension: params.dimension,
          status: 'embedded',
          attempts: 0,
          lastError: null,
          embeddedAt: now,
          updatedAt: now
        }
      })
  })
}

function embedLedgerScopeSql(params?: EmbedLedgerReconcileParams) {
  const parts = [sql`source_type IN ('diary', 'memory')`]
  const sourceType = params?.sourceType?.trim()
  if (sourceType === 'diary' || sourceType === 'memory') {
    parts[0] = sql`source_type = ${sourceType}`
  }
  const vaultId = params?.vaultId?.trim()
  if (vaultId) parts.push(sql`vault_id = ${vaultId}`)
  return sql.join(parts, sql` AND `)
}

async function readEmbedLedgerCountGap(params?: EmbedLedgerReconcileParams): Promise<{
  ledgerChunkSum: number
  vectorCount: number
  mismatch: boolean
}> {
  const db = getAppDb()
  const scope = embedLedgerScopeSql(params)
  const ledgerRows = await db.all(sql`
      SELECT vault_id AS vaultId, source_type AS sourceType,
             COALESCE(SUM(chunk_count), 0) AS chunkSum
      FROM embed_ledger
      WHERE ${scope}
      GROUP BY vault_id, source_type
    `)
  const vectorRows = await db.all(sql`
      SELECT vault_id AS vaultId, source_type AS sourceType, COUNT(*) AS vectorCount
      FROM memory_embeddings
      WHERE ${scope}
      GROUP BY vault_id, source_type
    `)

  const ledgerMap = new Map<string, number>()
  for (const raw of ledgerRows) {
    const row = raw as Record<string, unknown>
    const key = `${String(row.vaultId ?? '')}\0${String(row.sourceType ?? '')}`
    ledgerMap.set(key, Number(row.chunkSum ?? 0))
  }
  const vectorMap = new Map<string, number>()
  for (const raw of vectorRows) {
    const row = raw as Record<string, unknown>
    const key = `${String(row.vaultId ?? '')}\0${String(row.sourceType ?? '')}`
    vectorMap.set(key, Number(row.vectorCount ?? 0))
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

async function insertRebuiltLedgerRow(row: AggregatedEmbedLedgerRow): Promise<void> {
  const now = Date.now()
  const stamp = row.updatedAt > 0 ? row.updatedAt : now
  const db = getAppDb()
  await db
    .insert(embedLedgerTable)
    .values({
      vaultId: row.vaultId,
      sourceType: row.sourceType,
      sourceId: row.sourceId,
      contentHash: row.contentHash,
      chunkCount: row.chunkCount,
      modelId: row.modelId,
      dimension: row.dimension,
      status: 'embedded',
      attempts: 0,
      lastError: null,
      embeddedAt: stamp,
      updatedAt: stamp
    })
    .onConflictDoUpdate({
      target: [embedLedgerTable.vaultId, embedLedgerTable.sourceType, embedLedgerTable.sourceId],
      set: {
        contentHash: row.contentHash,
        chunkCount: row.chunkCount,
        modelId: row.modelId,
        dimension: row.dimension,
        status: 'embedded',
        attempts: 0,
        lastError: null,
        embeddedAt: stamp,
        updatedAt: stamp
      }
    })
}

export async function rebuildEmbedLedgerUnlocked(
  params?: EmbedLedgerReconcileParams
): Promise<void> {
  const db = getAppDb()
  const scope = embedLedgerScopeSql(params)
  const rawVectors = await db.all(sql`
      SELECT vault_id AS vaultId, source_type AS sourceType, source_id AS sourceId,
             model_id AS modelId, dimension, metadata_json AS metadataJson
      FROM memory_embeddings
      WHERE ${scope}
    `)
  const vectorRows: EmbedLedgerVectorRow[] = rawVectors.map((raw) => {
    const row = raw as Record<string, unknown>
    return {
      vaultId: String(row.vaultId ?? ''),
      sourceType: String(row.sourceType ?? ''),
      sourceId: String(row.sourceId ?? ''),
      modelId: String(row.modelId ?? ''),
      dimension: Number(row.dimension ?? 0),
      metadataJson: String(row.metadataJson ?? '{}')
    }
  })

  const rawZeros = await db.all(sql`
      SELECT vault_id AS vaultId, source_type AS sourceType, source_id AS sourceId,
             content_hash AS contentHash, model_id AS modelId, dimension, updated_at AS updatedAt
      FROM embed_ledger
      WHERE ${scope} AND status = 'embedded' AND chunk_count = 0
    `)
  const zeroRows: AggregatedEmbedLedgerRow[] = rawZeros.map((raw) => {
    const row = raw as Record<string, unknown>
    return {
      vaultId: String(row.vaultId ?? ''),
      sourceType: String(row.sourceType ?? ''),
      sourceId: String(row.sourceId ?? ''),
      contentHash: String(row.contentHash ?? ''),
      chunkCount: 0,
      modelId: String(row.modelId ?? ''),
      dimension: Number(row.dimension ?? 0),
      updatedAt: Number(row.updatedAt ?? 0)
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
  await db.run(sql.raw(`SAVEPOINT ${EMBED_LEDGER_REBUILD_SAVEPOINT}`))
  try {
    await db.run(sql`DELETE FROM embed_ledger WHERE ${scope}`)
    for (const row of pending) {
      await insertRebuiltLedgerRow(row)
    }
    await db.run(sql.raw(`RELEASE ${EMBED_LEDGER_REBUILD_SAVEPOINT}`))
  } catch (e) {
    try {
      await db.run(sql.raw(`ROLLBACK TO ${EMBED_LEDGER_REBUILD_SAVEPOINT}`))
      await db.run(sql.raw(`RELEASE ${EMBED_LEDGER_REBUILD_SAVEPOINT}`))
    } catch {
      // 保存点已经不存在时忽略：原始异常才是要往上抛的那个
    }
    throw e
  }

  await finishEmbedLedgerRebuild(params?.onRebuilt)
}

export async function reconcileEmbedLedger(
  params?: EmbedLedgerReconcileParams
): Promise<EmbedLedgerReconcileResult> {
  return withEmbeddingWriteLock(async () => {
    const { ledgerChunkSum, vectorCount, mismatch } = await readEmbedLedgerCountGap(params)
    if (!mismatch) {
      return { rebuilt: false, ledgerChunkSum, vectorCount }
    }
    await rebuildEmbedLedgerUnlocked(params)
    return { rebuilt: true, ledgerChunkSum, vectorCount }
  })
}

export async function rebuildEmbedLedger(params?: EmbedLedgerReconcileParams): Promise<void> {
  await withEmbeddingWriteLock(() => rebuildEmbedLedgerUnlocked(params))
}

export async function recordEmbedFailure(params: EmbedLedgerFailureParams): Promise<void> {
  await withEmbeddingWriteLock(async () => {
    const db = getAppDb()
    const vaultId = params.vaultId.trim()
    if (!vaultId) {
      throw new Error('recordEmbedFailure: vaultId is required')
    }
    const now = Date.now()
    await db
      .insert(embedLedgerTable)
      .values({
        vaultId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        contentHash: '',
        chunkCount: 0,
        modelId: '',
        dimension: 0,
        status: 'failed',
        attempts: 1,
        lastError: params.lastError,
        embeddedAt: null,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: [embedLedgerTable.vaultId, embedLedgerTable.sourceType, embedLedgerTable.sourceId],
        set: {
          status: 'failed',
          attempts: sql`${embedLedgerTable.attempts} + 1`,
          lastError: params.lastError,
          updatedAt: now
        }
      })
  })
}
