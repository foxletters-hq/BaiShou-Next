import { and, eq, sql } from 'drizzle-orm'
import {
  knowledgeChunksTable,
  knowledgeEmbedLedgerTable,
  knowledgeSourcesTable,
  type KnowledgeEmbedLedgerRow
} from '../schema/knowledge'
import type { AppDatabase } from '../types'
import {
  KNOWLEDGE_EMBED_LEDGER_REBUILD_SAVEPOINT,
  type KnowledgeEmbedLedgerRecord,
  type KnowledgeEmbedLedgerView
} from './knowledge.repository.types'

export class KnowledgeEmbedOps {
  constructor(private readonly db: AppDatabase) {}

  async getEmbedLedger(
    vaultId: string,
    sourceId: string
  ): Promise<KnowledgeEmbedLedgerView | null> {
    const vid = vaultId.trim()
    const sid = sourceId.trim()
    if (!vid || !sid) return null
    const rows = await this.db
      .select()
      .from(knowledgeEmbedLedgerTable)
      .where(
        and(eq(knowledgeEmbedLedgerTable.vaultId, vid), eq(knowledgeEmbedLedgerTable.sourceId, sid))
      )
      .limit(1)
    const row = rows[0]
    return row ? this.toEmbedLedgerView(row) : null
  }

  async recordEmbedded(params: KnowledgeEmbedLedgerRecord): Promise<void> {
    const vaultId = params.vaultId.trim()
    const sourceId = params.sourceId.trim()
    if (!vaultId) throw new Error('recordEmbedded: vaultId is required')
    if (!sourceId) throw new Error('recordEmbedded: sourceId is required')
    const now = Date.now()
    await this.db
      .insert(knowledgeEmbedLedgerTable)
      .values({
        vaultId,
        sourceId,
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
        target: [knowledgeEmbedLedgerTable.vaultId, knowledgeEmbedLedgerTable.sourceId],
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
  }

  async recordEmbedFailure(params: {
    vaultId: string
    sourceId: string
    lastError?: string | null
    chunkCount?: number
  }): Promise<void> {
    const vaultId = params.vaultId.trim()
    const sourceId = params.sourceId.trim()
    if (!vaultId) throw new Error('recordEmbedFailure: vaultId is required')
    if (!sourceId) throw new Error('recordEmbedFailure: sourceId is required')
    const now = Date.now()
    const existing = await this.getEmbedLedger(vaultId, sourceId)
    if (existing) {
      await this.db
        .update(knowledgeEmbedLedgerTable)
        .set({
          status: 'failed',
          attempts: sql`${knowledgeEmbedLedgerTable.attempts} + 1`,
          lastError: params.lastError ?? null,
          ...(params.chunkCount != null ? { chunkCount: params.chunkCount } : {}),
          updatedAt: now
        })
        .where(
          and(
            eq(knowledgeEmbedLedgerTable.vaultId, vaultId),
            eq(knowledgeEmbedLedgerTable.sourceId, sourceId)
          )
        )
      return
    }
    await this.db.insert(knowledgeEmbedLedgerTable).values({
      vaultId,
      sourceId,
      contentHash: '',
      chunkCount: 0,
      modelId: '',
      dimension: 0,
      status: 'failed',
      attempts: 1,
      lastError: params.lastError ?? null,
      embeddedAt: null,
      updatedAt: now
    })
  }

  async deleteEmbedLedgerBySource(sourceId: string): Promise<void> {
    const sid = sourceId.trim()
    if (!sid) return
    await this.db
      .delete(knowledgeEmbedLedgerTable)
      .where(eq(knowledgeEmbedLedgerTable.sourceId, sid))
  }

  async reconcileEmbedLedger(params?: { vaultId?: string }): Promise<{
    rebuilt: boolean
    ledgerChunkSum: number
    vectorCount: number
  }> {
    const { ledgerChunkSum, vectorCount, mismatch } = await this.readEmbedLedgerCountGap(params)
    if (!mismatch) {
      return { rebuilt: false, ledgerChunkSum, vectorCount }
    }
    await this.rebuildEmbedLedger(params)
    return { rebuilt: true, ledgerChunkSum, vectorCount }
  }

  async rebuildEmbedLedger(params?: { vaultId?: string }): Promise<void> {
    const vaultId = params?.vaultId?.trim()
    const chunkFilters = vaultId ? [eq(knowledgeChunksTable.vaultId, vaultId)] : []
    const ledgerFilters = vaultId ? [eq(knowledgeEmbedLedgerTable.vaultId, vaultId)] : []

    const chunkRows = await this.db
      .select({
        vaultId: knowledgeChunksTable.vaultId,
        sourceId: knowledgeChunksTable.sourceId,
        modelId: knowledgeChunksTable.modelId,
        dimension: knowledgeChunksTable.dimension,
        chunkCount: sql<number>`count(*)`
      })
      .from(knowledgeChunksTable)
      .where(chunkFilters.length ? and(...chunkFilters) : undefined)
      .groupBy(
        knowledgeChunksTable.vaultId,
        knowledgeChunksTable.sourceId,
        knowledgeChunksTable.modelId,
        knowledgeChunksTable.dimension
      )

    const aggregated = new Map<
      string,
      {
        vaultId: string
        sourceId: string
        chunkCount: number
        modelId: string
        dimension: number
        contentHash: string
      }
    >()
    for (const row of chunkRows) {
      const key = `${row.vaultId}\0${row.sourceId}`
      const prev = aggregated.get(key)
      const chunkCount = Number(row.chunkCount ?? 0)
      if (!prev) {
        aggregated.set(key, {
          vaultId: String(row.vaultId ?? ''),
          sourceId: String(row.sourceId ?? ''),
          chunkCount,
          modelId: String(row.modelId ?? ''),
          dimension: Number(row.dimension ?? 0),
          contentHash: ''
        })
        continue
      }
      prev.chunkCount += chunkCount
    }

    const zeroRows = await this.db
      .select()
      .from(knowledgeEmbedLedgerTable)
      .where(
        ledgerFilters.length
          ? and(
              ...ledgerFilters,
              eq(knowledgeEmbedLedgerTable.status, 'embedded'),
              eq(knowledgeEmbedLedgerTable.chunkCount, 0)
            )
          : and(
              eq(knowledgeEmbedLedgerTable.status, 'embedded'),
              eq(knowledgeEmbedLedgerTable.chunkCount, 0)
            )
      )
    for (const row of zeroRows) {
      const key = `${row.vaultId}\0${row.sourceId}`
      if (aggregated.has(key)) continue
      aggregated.set(key, {
        vaultId: row.vaultId,
        sourceId: row.sourceId,
        chunkCount: 0,
        modelId: row.modelId,
        dimension: row.dimension,
        contentHash: row.contentHash
      })
    }

    const existingHashes = await this.db
      .select({
        vaultId: knowledgeEmbedLedgerTable.vaultId,
        sourceId: knowledgeEmbedLedgerTable.sourceId,
        contentHash: knowledgeEmbedLedgerTable.contentHash
      })
      .from(knowledgeEmbedLedgerTable)
      .where(ledgerFilters.length ? and(...ledgerFilters) : undefined)
    const hashByKey = new Map(
      existingHashes.map((row) => [`${row.vaultId}\0${row.sourceId}`, row.contentHash])
    )
    for (const row of aggregated.values()) {
      if (!row.contentHash) {
        row.contentHash = hashByKey.get(`${row.vaultId}\0${row.sourceId}`) ?? ''
      }
    }

    const now = Date.now()
    await this.withEmbedLedgerSavepoint(async () => {
      if (vaultId) {
        await this.db
          .delete(knowledgeEmbedLedgerTable)
          .where(eq(knowledgeEmbedLedgerTable.vaultId, vaultId))
      } else {
        await this.db.delete(knowledgeEmbedLedgerTable)
      }
      for (const row of aggregated.values()) {
        if (!row.vaultId || !row.sourceId) continue
        await this.db.insert(knowledgeEmbedLedgerTable).values({
          vaultId: row.vaultId,
          sourceId: row.sourceId,
          contentHash: row.contentHash,
          chunkCount: row.chunkCount,
          modelId: row.modelId,
          dimension: row.dimension,
          status: 'embedded',
          attempts: 0,
          lastError: null,
          embeddedAt: now,
          updatedAt: now
        })
      }
    })
  }

  async countPendingEmbedSources(
    vaultId: string,
    options?: { modelId?: string; dimension?: number }
  ): Promise<number> {
    const vid = vaultId.trim()
    if (!vid) return 0
    await this.reconcileEmbedLedger({ vaultId: vid })
    const pending = await this.listPendingEmbedSources(vid, options)
    return pending.length
  }

  async listPendingEmbedSources(
    vaultId: string,
    options?: { modelId?: string; dimension?: number }
  ): Promise<Array<{ id: string; notebookId: string; vaultId: string }>> {
    const vid = vaultId.trim()
    if (!vid) return []
    const sources = await this.db
      .select({
        id: knowledgeSourcesTable.id,
        notebookId: knowledgeSourcesTable.notebookId,
        vaultId: knowledgeSourcesTable.vaultId,
        extractedTextHash: knowledgeSourcesTable.extractedTextHash
      })
      .from(knowledgeSourcesTable)
      .where(eq(knowledgeSourcesTable.vaultId, vid))
    const ledgerRows = await this.db
      .select()
      .from(knowledgeEmbedLedgerTable)
      .where(eq(knowledgeEmbedLedgerTable.vaultId, vid))
    const ledgerBySource = new Map(
      ledgerRows.map((row) => [row.sourceId, this.toEmbedLedgerView(row)])
    )
    const modelId = options?.modelId?.trim() ?? ''
    const dimension = options?.dimension ?? 0
    const pending: Array<{ id: string; notebookId: string; vaultId: string }> = []
    for (const source of sources) {
      if (!source.extractedTextHash?.trim()) continue
      const ledger = ledgerBySource.get(source.id)
      if (!ledger || ledger.status !== 'embedded') {
        pending.push({ id: source.id, notebookId: source.notebookId, vaultId: source.vaultId })
        continue
      }
      if (modelId && ledger.modelId !== modelId) {
        pending.push({ id: source.id, notebookId: source.notebookId, vaultId: source.vaultId })
        continue
      }
      if (dimension > 0 && ledger.dimension !== dimension) {
        pending.push({ id: source.id, notebookId: source.notebookId, vaultId: source.vaultId })
      }
    }
    return pending
  }

  private toEmbedLedgerView(row: KnowledgeEmbedLedgerRow): KnowledgeEmbedLedgerView {
    return {
      vaultId: row.vaultId,
      sourceId: row.sourceId,
      contentHash: row.contentHash,
      chunkCount: row.chunkCount,
      modelId: row.modelId,
      dimension: row.dimension,
      status: row.status
    }
  }

  private async readEmbedLedgerCountGap(params?: { vaultId?: string }): Promise<{
    ledgerChunkSum: number
    vectorCount: number
    mismatch: boolean
  }> {
    const vaultId = params?.vaultId?.trim()
    const ledgerFilters = vaultId ? [eq(knowledgeEmbedLedgerTable.vaultId, vaultId)] : []
    const chunkFilters = vaultId ? [eq(knowledgeChunksTable.vaultId, vaultId)] : []
    const sumRows = await this.db
      .select({ c: sql<number>`coalesce(sum(${knowledgeEmbedLedgerTable.chunkCount}), 0)` })
      .from(knowledgeEmbedLedgerTable)
      .where(ledgerFilters.length ? and(...ledgerFilters) : undefined)
    const countRows = await this.db
      .select({ c: sql<number>`count(*)` })
      .from(knowledgeChunksTable)
      .where(chunkFilters.length ? and(...chunkFilters) : undefined)
    const ledgerChunkSum = Number(sumRows[0]?.c ?? 0)
    const vectorCount = Number(countRows[0]?.c ?? 0)
    return {
      ledgerChunkSum,
      vectorCount,
      mismatch: ledgerChunkSum !== vectorCount
    }
  }

  private async withEmbedLedgerSavepoint(run: () => Promise<void>): Promise<void> {
    const db = this.db as { run?: (query: unknown) => Promise<unknown> }
    if (typeof db.run !== 'function') {
      await this.db.transaction(async () => {
        await run()
      })
      return
    }
    await db.run(sql.raw(`SAVEPOINT ${KNOWLEDGE_EMBED_LEDGER_REBUILD_SAVEPOINT}`))
    try {
      await run()
      await db.run(sql.raw(`RELEASE SAVEPOINT ${KNOWLEDGE_EMBED_LEDGER_REBUILD_SAVEPOINT}`))
    } catch (error) {
      await db
        .run(sql.raw(`ROLLBACK TO SAVEPOINT ${KNOWLEDGE_EMBED_LEDGER_REBUILD_SAVEPOINT}`))
        .catch(() => undefined)
      await db
        .run(sql.raw(`RELEASE SAVEPOINT ${KNOWLEDGE_EMBED_LEDGER_REBUILD_SAVEPOINT}`))
        .catch(() => undefined)
      throw error
    }
  }
}
