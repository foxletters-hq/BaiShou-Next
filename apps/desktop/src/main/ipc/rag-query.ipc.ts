import { ipcMain } from 'electron'
import i18n from 'i18next'
import { shardMonthFromInstant } from '@baishou/core-desktop'
import {
  GraphRepository,
  memoryEmbeddingsTable,
  SqliteHybridSearchRepository
} from '@baishou/database-desktop'
import { getAppDb } from '../db'
import { eq, desc, like, sql, and, or } from 'drizzle-orm'
import {
  buildMemoryMetadataJson,
  EMBEDDING_SOURCE_SORT_MILLIS_SQL,
  MEMORY_EMBED_GROUP_ID,
  MEMORY_SOURCE_TYPE,
  parseMemoryMetadataJson,
  timestampToMillis,
  type MemoryRawRecord,
  type RagVectorKindFilter,
  GRAPH_NODE_SOURCE_TYPE,
  graphNodeEmbeddingId,
  parseGraphNodeEmbeddingId,
  toSerializableAiError
} from '@baishou/shared'
import { getEmbeddingService, getEmbeddingConfig } from './rag.ipc'
import { getMemoryRawManager, getRawDataSourceManager } from '../services/raw-data-source.runtime'
import { vaultService, resolveActiveVaultId } from './vault.ipc'

function memorySourceKindFilter(sourceKind?: RagVectorKindFilter) {
  if (!sourceKind || sourceKind === 'all' || sourceKind === 'graph_node') return undefined
  if (sourceKind === 'diary') return eq(memoryEmbeddingsTable.sourceType, 'diary')
  if (sourceKind === 'manual') {
    return or(
      eq(memoryEmbeddingsTable.sourceType, 'manual'),
      and(
        eq(memoryEmbeddingsTable.sourceType, MEMORY_SOURCE_TYPE),
        sql`json_extract(${memoryEmbeddingsTable.metadataJson}, '$.sourceSessionId') IS NULL`
      )
    )
  }
  return and(
    eq(memoryEmbeddingsTable.sourceType, MEMORY_SOURCE_TYPE),
    sql`json_extract(${memoryEmbeddingsTable.metadataJson}, '$.sourceSessionId') IS NOT NULL`
  )
}

function graphNodeToEntry(row: {
  id: string
  name: string
  summary: string
  modelId: string
  updatedAt: number
  similarity?: number
}) {
  return {
    embeddingId: graphNodeEmbeddingId(row.id),
    text: `${row.name}\n${row.summary || ''}`.trim(),
    modelId: row.modelId || 'unknown',
    createdAt: row.updatedAt,
    sourceType: GRAPH_NODE_SOURCE_TYPE,
    sourceId: row.id,
    tags: [] as string[],
    sourceSessionId: undefined,
    memoryCreatedAt: undefined,
    memoryUpdatedAt: undefined,
    isManual: false,
    similarity: row.similarity
  }
}

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
    ? meta.sourceSessionId !== undefined
      ? meta.sourceSessionId
      : base.sourceType === 'manual'
        ? null
        : undefined
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
        sourceKind?: RagVectorKindFilter
      }
    ) => {
      const db = getAppDb()
      const activeVaultId = resolveActiveVaultId()
      const sourceKind = params.sourceKind
      const includeMemory = sourceKind !== 'graph_node'
      const includeGraph = sourceKind === 'all' || sourceKind === 'graph_node'
      const kindFilter = memorySourceKindFilter(sourceKind ?? 'all')
      const vaultScopeFilter = and(
        eq(memoryEmbeddingsTable.vaultId, activeVaultId),
        ...(kindFilter ? [kindFilter] : [])
      )

      // ── 语义检索分支（Semantic Search Mode） ──
      if (params.mode === 'semantic' && params.keyword && params.keyword.trim() !== '') {
        await config.load()
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
                const memoryEntries = includeMemory
                  ? await (async () => {
                      const vectorResults = await hybridRepo.queryNativeVector(queryVector, limit, {
                        vaultId: activeVaultId
                      })
                      const metaMap = await loadMetadataByEmbeddingIds(
                        vectorResults.map((r) => r.messageId).filter(Boolean)
                      )
                      return vectorResults
                        .map((r) => {
                          const metaRow = metaMap.get(r.messageId)
                          return enrichEntryFromMetadata({
                            embeddingId: r.messageId,
                            text: r.chunkText,
                            modelId: config.getGlobalEmbeddingModelId() || 'unknown',
                            createdAt:
                              timestampToMillis(
                                typeof r.createdAt === 'number' ? r.createdAt : undefined
                              ) ?? Date.now(),
                            sourceType: r.sourceType,
                            similarity: r.score,
                            sourceId: metaRow?.sourceId,
                            metadataJson: metaRow?.metadataJson
                          })
                        })
                        .filter((entry) => {
                          if (sourceKind === 'diary') return entry.sourceType === 'diary'
                          if (sourceKind === 'manual') return entry.isManual
                          if (sourceKind === 'partner') {
                            return entry.sourceType === MEMORY_SOURCE_TYPE && !entry.isManual
                          }
                          return true
                        })
                    })()
                  : []

                const graphEntries = includeGraph
                  ? await (async () => {
                      try {
                        return (
                          await new GraphRepository(db).searchNodesByVector(
                            activeVaultId,
                            queryVector,
                            limit
                          )
                        ).map((row) =>
                          graphNodeToEntry({
                            id: row.id,
                            name: row.name,
                            summary: row.summary ?? '',
                            modelId: row.modelId ?? '',
                            updatedAt: row.updatedAt,
                            similarity: Number.isFinite(row.distance)
                              ? 1 - row.distance
                              : undefined
                          })
                        )
                      } catch (err) {
                        console.error('[rag.ipc] Graph semantic search failed:', err)
                        return []
                      }
                    })()
                  : []

                const entries = [...memoryEntries, ...graphEntries]
                  .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
                  .slice(0, limit)

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
          console.error('[rag.ipc] Semantic search failed:', err)
          throw toSerializableAiError(err)
        }
        throw new Error('语义搜索未能完成：嵌入服务未就绪或未返回向量。')
      }

      // ── 传统文本检索分支（仅 mode === 'text'，或未带关键词的浏览列表） ──
      const keyword = params.keyword?.trim() || ''
      const limit = params.limit || 10
      const offset = params.offset || 0
      const graphRepo = new GraphRepository(db)

      if (!includeMemory && includeGraph) {
        const [nodeRows, total] = await Promise.all([
          graphRepo.listEmbeddedLiveNodesPage(activeVaultId, { keyword, limit, offset }),
          graphRepo.countEmbeddedLiveNodes(activeVaultId, keyword || undefined)
        ])
        const entries = nodeRows.map((row) => graphNodeToEntry(row))
        return params.withTotal ? { entries, total } : entries
      }

      const listFilter = keyword
        ? and(vaultScopeFilter, like(memoryEmbeddingsTable.chunkText, `%${keyword}%`))
        : vaultScopeFilter

      const memoryListQuery = db
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
        .orderBy(
          sql.raw(`${EMBEDDING_SOURCE_SORT_MILLIS_SQL} DESC`),
          desc(memoryEmbeddingsTable.embeddingId)
        )
        .limit(includeGraph ? limit + offset : limit)
        .offset(includeGraph ? 0 : offset)

      const memoryCountQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(memoryEmbeddingsTable)
        .where(listFilter)

      const [memoryResults, memoryCountRes, nodeRows, nodeTotal] = await Promise.all([
        memoryListQuery,
        memoryCountQuery,
        includeGraph
          ? graphRepo.listEmbeddedLiveNodesPage(activeVaultId, {
              keyword,
              limit: limit + offset,
              offset: 0
            })
          : Promise.resolve([]),
        includeGraph
          ? graphRepo.countEmbeddedLiveNodes(activeVaultId, keyword || undefined)
          : Promise.resolve(0)
      ])

      const memoryEntries = memoryResults.map((r) =>
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

      let entries = memoryEntries
      let total = Number(memoryCountRes[0]?.count || 0)

      if (includeGraph) {
        const merged = [...memoryEntries, ...nodeRows.map((row) => graphNodeToEntry(row))].sort(
          (a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)
        )
        entries = merged.slice(offset, offset + limit)
        total += nodeTotal
      }

      if (params.withTotal) {
        return { entries, total }
      }

      return entries
    }
  )

  ipcMain.handle('rag:delete-entry', async (_, embeddingId: string) => {
    try {
      const db = getAppDb()
      const graphNodeId = parseGraphNodeEmbeddingId(embeddingId)
      if (graphNodeId) {
        const graphRepo = new GraphRepository(db)
        await graphRepo.clearNodeEmbedding(graphNodeId, resolveActiveVaultId())
        return true
      }
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

      if (sourceType === 'diary') {
        const { parseDiaryEmbeddingSourceId } = await import('@baishou/shared')
        const { deleteDiaryEmbeddingAliases } = await import('../services/diary-embedding.util')

        const parsed = parseDiaryEmbeddingSourceId(sourceId)
        const vaultId =
          parsed?.vaultId?.trim() || String(record.vaultId ?? '').trim() || resolveActiveVaultId()
        const diaryIdRaw = parsed?.diaryId ?? sourceId
        const diaryId = Number(diaryIdRaw)
        if (Number.isFinite(diaryId)) {
          await deleteDiaryEmbeddingAliases(vaultId, diaryId)
        } else {
          await db
            .delete(memoryEmbeddingsTable)
            .where(eq(memoryEmbeddingsTable.embeddingId, embeddingId))
        }
        return true
      }

      await db
        .delete(memoryEmbeddingsTable)
        .where(eq(memoryEmbeddingsTable.embeddingId, embeddingId))
      return true
    } finally {
      const { notifyPendingEmbedCountsChanged } =
        await import('../services/pending-embed-counts.service')
      notifyPendingEmbedCountsChanged()
    }
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
    // 日记的向量由日记正文生成，正文是唯一事实来源。就地改切片会让账本的内容哈希与
    // 模型停在旧值，而切片总数没变、计数自检抓不到；下一次补齐又会按正文重新生成、
    // 覆盖掉这次手改。直接挡住，让用户去改日记本身。
    if (record.sourceType === 'diary') {
      throw new Error(
        i18n.t(
          'settings.rag_edit_diary_blocked',
          '日记的记忆片段由日记正文生成，请直接编辑对应日记，然后在记忆中心重新补齐嵌入。'
        )
      )
    }
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
    const vaultName = existing?.vaultName ?? vaultService.getActiveVault()?.name ?? 'Personal'
    const vaultId = existing?.vaultId ?? resolveActiveVaultId()
    const createdAt = existing?.createdAt ?? createdAtMs ?? now
    const updated: MemoryRawRecord = {
      id: record.sourceId,
      schemaVersion: 1,
      vaultId,
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
}
