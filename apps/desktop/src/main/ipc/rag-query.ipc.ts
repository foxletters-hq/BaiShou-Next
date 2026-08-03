import { ipcMain } from 'electron'
import { shardMonthFromInstant } from '@baishou/core-desktop'
import {
  createSqlExecutorFromDrizzleDb,
  memoryEmbeddingsTable,
  SqliteHybridSearchRepository
} from '@baishou/database-desktop'
import { getAppDb } from '../db'
import { eq, desc, like, sql, and } from 'drizzle-orm'
import {
  buildMemoryMetadataJson,
  EMBEDDING_SOURCE_SORT_MILLIS_SQL,
  MEMORY_EMBED_GROUP_ID,
  MEMORY_SOURCE_TYPE,
  parseMemoryMetadataJson,
  timestampToMillis,
  type MemoryRawRecord
} from '@baishou/shared'
import { getEmbeddingService, getEmbeddingConfig } from './rag.ipc'
import {
  checkMemoryConsistency,
  getMemoryRawManager,
  getRawDataSourceManager,
  repairMemoryConsistency
} from '../services/raw-data-source.runtime'
import { vaultService, resolveActiveVaultId, resolveVaultIdByName } from './vault.ipc'

function embeddingInstantMs(value: unknown): number | undefined {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number') return timestampToMillis(value)
  return undefined
}

function enrichEntryFromMetadata(base: {
  embeddingId: string
  text: string
  modelId: string
  createdAt: number
  sourceType?: string
  similarity?: number
  sourceId?: string | null
  metadataJson?: string | null
}) {
  const meta = parseMemoryMetadataJson(base.metadataJson)
  const isMemoryLike = base.sourceType === MEMORY_SOURCE_TYPE || base.sourceType === 'manual'
  const sourceSessionId = isMemoryLike
    ? (meta.sourceSessionId !== undefined
        ? meta.sourceSessionId
        : base.sourceType === 'manual'
          ? null
          : undefined)
    : undefined
  const isManual =
    base.sourceType === 'manual' ||
    (base.sourceType === MEMORY_SOURCE_TYPE && meta.sourceSessionId === null)
  return {
    embeddingId: base.embeddingId,
    text: base.text,
    modelId: base.modelId,
    createdAt: meta.createdAt ?? base.createdAt,
    sourceType: base.sourceType,
    similarity: base.similarity,
    sourceId: base.sourceId ?? undefined,
    tags: meta.tags ?? [],
    sourceSessionId,
    memoryCreatedAt: meta.createdAt,
    memoryUpdatedAt: meta.updatedAt,
    isManual
  }
}

async function loadMetadataByEmbeddingIds(
  embeddingIds: string[]
): Promise<Map<string, { sourceId: string; metadataJson: string | null }>> {
  const map = new Map<string, { sourceId: string; metadataJson: string | null }>()
  if (embeddingIds.length === 0) return map
  const db = getAppDb()
  for (const embeddingId of embeddingIds) {
    const rows = await db
      .select({
        embeddingId: memoryEmbeddingsTable.embeddingId,
        sourceId: memoryEmbeddingsTable.sourceId,
        metadataJson: memoryEmbeddingsTable.metadataJson
      })
      .from(memoryEmbeddingsTable)
      .where(eq(memoryEmbeddingsTable.embeddingId, embeddingId))
      .limit(1)
    const row = rows[0]
    if (row) {
      map.set(row.embeddingId, {
        sourceId: row.sourceId,
        metadataJson: row.metadataJson
      })
    }
  }
  return map
}

/** 分页列表：优先 source_created_at（日记 date），兼容秒/毫秒混用 */
const embeddingSortMillis = sql.raw(EMBEDDING_SOURCE_SORT_MILLIS_SQL)

export function registerRagQueryIPC() {
  const config = getEmbeddingConfig()
  const embeddingService = getEmbeddingService()

  ipcMain.handle(
    'rag:query-entries',
    async (
      _,
      params: {
        keyword?: string
        limit?: number
        offset?: number
        mode?: 'semantic' | 'text'
        withTotal?: boolean
      }
    ) => {
      await config.load()
      const db = getAppDb()
      const activeVaultId = resolveActiveVaultId()
      const vaultScopeFilter = eq(memoryEmbeddingsTable.vaultId, activeVaultId)

      // ── 语义检索分支（Semantic Search Mode） ──
      if (params.mode === 'semantic' && params.keyword && params.keyword.trim() !== '') {
        try {
          if (embeddingService.isConfigured) {
            const queryVector = await embeddingService.embedQuery(params.keyword)
            if (queryVector) {
              const rawClient = (db as any).session?.client || (db as any).$client
              if (rawClient) {
                // 多态完美伪装：为 better-sqlite3 包装 execute，无缝适配 SqliteHybridSearchRepository
                const mockClient =
                  typeof rawClient.execute === 'function'
                    ? rawClient
                    : {
                        execute: async (
                          statement: string | { sql: string; args?: any[] },
                          args?: any[]
                        ) => {
                          let sqlStr = ''
                          let sqlArgs: any[] = []
                          if (typeof statement === 'string') {
                            sqlStr = statement
                            sqlArgs = args || []
                          } else {
                            sqlStr = statement.sql
                            sqlArgs = statement.args || []
                          }

                          const stmt = rawClient.prepare(sqlStr)
                          if (
                            sqlStr.trim().toUpperCase().startsWith('SELECT') ||
                            sqlStr.trim().toUpperCase().startsWith('PRAGMA')
                          ) {
                            const rows = stmt.all(...sqlArgs)
                            return { rows }
                          } else {
                            const res = stmt.run(...sqlArgs)
                            return { rows: [], ...res }
                          }
                        }
                      }

                const hybridRepo = new SqliteHybridSearchRepository(mockClient as any)
                const limit = params.limit || 30
                const vectorResults = await hybridRepo.queryNativeVector(queryVector, limit, {
                  vaultId: activeVaultId
                })

                const metaMap = await loadMetadataByEmbeddingIds(
                  vectorResults.map((r) => r.messageId).filter(Boolean)
                )

                const entries = vectorResults.map((r) => {
                  const metaRow = metaMap.get(r.messageId)
                  return enrichEntryFromMetadata({
                    embeddingId: r.messageId,
                    text: r.chunkText,
                    modelId: config.getGlobalEmbeddingModelId() || 'unknown',
                    createdAt:
                      timestampToMillis(typeof r.createdAt === 'number' ? r.createdAt : undefined) ??
                      Date.now(),
                    sourceType: r.sourceType,
                    similarity: r.score,
                    sourceId: metaRow?.sourceId,
                    metadataJson: metaRow?.metadataJson
                  })
                })

                if (params.withTotal) {
                  return {
                    entries,
                    total: entries.length
                  }
                }
                return entries
              }
            }
          }
        } catch (err) {
          console.error('[rag.ipc] Semantic search failed, falling back to text search:', err)
        }
      }

      // ── 传统文本检索分支（Keyword/Text Search Mode, or fallback） ──
      const listFilter =
        params.keyword && params.keyword.trim() !== ''
          ? and(vaultScopeFilter, like(memoryEmbeddingsTable.chunkText, `%${params.keyword}%`))
          : vaultScopeFilter

      const query = db
        .select({
          embeddingId: memoryEmbeddingsTable.embeddingId,
          text: memoryEmbeddingsTable.chunkText,
          modelId: memoryEmbeddingsTable.modelId,
          sourceType: memoryEmbeddingsTable.sourceType,
          sourceId: memoryEmbeddingsTable.sourceId,
          metadataJson: memoryEmbeddingsTable.metadataJson,
          sortMillis: embeddingSortMillis
        })
        .from(memoryEmbeddingsTable)
        .where(listFilter)

      const results = await query
        .orderBy(
          sql.raw(`${EMBEDDING_SOURCE_SORT_MILLIS_SQL} DESC`),
          desc(memoryEmbeddingsTable.embeddingId)
        )
        .limit(params.limit || 10)
        .offset(params.offset || 0)

      const entries = results.map((r) =>
        enrichEntryFromMetadata({
          embeddingId: r.embeddingId,
          text: r.text,
          modelId: r.modelId,
          createdAt: timestampToMillis(Number(r.sortMillis)) ?? Date.now(),
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          metadataJson: r.metadataJson
        })
      )

      if (params.withTotal) {
        let total = 0
        if (params.keyword && params.keyword.trim() !== '') {
          const countRes = await db
            .select({ count: sql<number>`count(*)` })
            .from(memoryEmbeddingsTable)
            .where(
              and(vaultScopeFilter, like(memoryEmbeddingsTable.chunkText, `%${params.keyword}%`))
            )
          total = countRes[0]?.count || 0
        } else {
          const countRes = await db
            .select({ count: sql<number>`count(*)` })
            .from(memoryEmbeddingsTable)
            .where(vaultScopeFilter)
          total = countRes[0]?.count || 0
        }
        return {
          entries,
          total
        }
      }

      return entries
    }
  )

  ipcMain.handle('rag:delete-entry', async (_, embeddingId: string) => {
    const db = getAppDb()
    const records = await db
      .select()
      .from(memoryEmbeddingsTable)
      .where(eq(memoryEmbeddingsTable.embeddingId, embeddingId))
    const record = records[0]
    if (!record) return true

    const sourceType = record.sourceType
    const sourceId = record.sourceId

    if (sourceType === MEMORY_SOURCE_TYPE || sourceType === 'manual') {
      const createdAtMs = embeddingInstantMs(record.sourceCreatedAt)
      const shardMonth = createdAtMs != null ? shardMonthFromInstant(createdAtMs) : undefined
      try {
        await getRawDataSourceManager().tombstone('memory', sourceId, { shardMonth })
      } catch {
        // legacy / already-absent JSONL rows: still drop derived embeddings
      }
      const { DesktopEmbeddingStorage } = await import('./rag.storage')
      const storage = new DesktopEmbeddingStorage()
      await storage.deleteEmbeddingsBySource(sourceType, sourceId)
      if (sourceType === 'manual') {
        await storage.deleteEmbeddingsBySource(MEMORY_SOURCE_TYPE, sourceId)
      }
      return true
    }

    await db.delete(memoryEmbeddingsTable).where(eq(memoryEmbeddingsTable.embeddingId, embeddingId))
    return true
  })

  ipcMain.handle('rag:edit-entry', async (_, params: { embeddingId: string; newText: string }) => {
    await config.load()
    if (!params.newText || !params.newText.trim()) return false

    const db = getAppDb()
    const records = await db
      .select()
      .from(memoryEmbeddingsTable)
      .where(eq(memoryEmbeddingsTable.embeddingId, params.embeddingId))
    const record = records[0]
    if (!record) throw new Error('Memory not found')

    const newText = params.newText.trim()
    if (record.sourceType !== MEMORY_SOURCE_TYPE && record.sourceType !== 'manual') {
      await embeddingService.updateMemoryChunk({
        entry: {
          embedding_id: record.embeddingId,
          source_type: record.sourceType,
          source_id: record.sourceId,
          group_id: record.groupId,
          vault_id: record.vaultId,
          chunk_index: record.chunkIndex,
          metadata_json: record.metadataJson
        },
        newText
      })
      return true
    }

    const createdAtMs = embeddingInstantMs(record.sourceCreatedAt)
    const shardMonth = createdAtMs != null ? shardMonthFromInstant(createdAtMs) : undefined
    const memoryMgr = getMemoryRawManager()

    let existing: MemoryRawRecord | undefined
    if (shardMonth) {
      const rows = await memoryMgr.readCollapsedShard(shardMonth)
      existing = rows.find((r) => r.id === record.sourceId && r.deletedAt == null)
    }
    if (!existing) {
      for (const shard of await memoryMgr.listShards()) {
        const rows = await memoryMgr.readCollapsedShard(shard.shardMonth)
        existing = rows.find((r) => r.id === record.sourceId && r.deletedAt == null)
        if (existing) break
      }
    }

    const now = Date.now()
    const vaultName =
      existing?.vaultName ?? vaultService.getActiveVault()?.name ?? 'Personal'
    const vaultId = resolveVaultIdByName(vaultName)
    const createdAt = existing?.createdAt ?? createdAtMs ?? now
    const updated: MemoryRawRecord = {
      id: record.sourceId,
      schemaVersion: 1,
      vaultName,
      content: newText,
      tags: existing?.tags ?? [],
      sourceSessionId: existing?.sourceSessionId ?? null,
      createdAt,
      updatedAt: now,
      deletedAt: null,
      ...(existing?.legacySourceId ? { legacySourceId: existing.legacySourceId } : {})
    }

    const written = await getRawDataSourceManager().writeRecord('memory', updated)
    await embeddingService.reEmbedText({
      text: newText,
      sourceType: MEMORY_SOURCE_TYPE,
      sourceId: updated.id,
      groupId: MEMORY_EMBED_GROUP_ID,
      vaultId,
      metadataJson: buildMemoryMetadataJson(updated),
      sourceCreatedAt: createdAt
    })
    if (record.sourceType === 'manual') {
      const { DesktopEmbeddingStorage } = await import('./rag.storage')
      await new DesktopEmbeddingStorage().deleteEmbeddingsBySource('manual', record.sourceId)
    }
    await memoryMgr.commitIndexed(written.relativePath, written.contentHash)
    return true
  })

  ipcMain.handle('rag:check-consistency', async () => {
    const hsRepo = new SqliteHybridSearchRepository(createSqlExecutorFromDrizzleDb(getAppDb()))
    const vaultId = resolveActiveVaultId()
    return checkMemoryConsistency({ hsRepo, vaultId })
  })

  ipcMain.handle(
    'rag:repair-consistency',
    async (
      _,
      params: {
        confirmDeleteIds?: string[]
        restoreIds?: string[]
        cleanOrphans?: boolean
      }
    ) => {
      const hsRepo = new SqliteHybridSearchRepository(createSqlExecutorFromDrizzleDb(getAppDb()))
      const vaultId = resolveActiveVaultId()
      let embeddingAdapter = null as import('@baishou/ai').EmbeddingAdapter | null
      if (params.restoreIds && params.restoreIds.length > 0) {
        try {
          const { resolveEmbeddingSystemModels } = await import('./agent-helpers')
          const { EmbeddingAdapter } = await import('@baishou/ai')
          const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()
          if (embeddingProvider && embeddingModelId) {
            embeddingAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
          }
        } catch {
          // restore will fail clearly below if adapter missing
        }
      }
      return repairMemoryConsistency({
        hsRepo,
        embeddingAdapter,
        vaultId,
        confirmDeleteIds: params.confirmDeleteIds,
        restoreIds: params.restoreIds,
        cleanOrphans: params.cleanOrphans
      })
    }
  )
}
