import { ipcMain } from 'electron'
import { memoryEmbeddingsTable, SqliteHybridSearchRepository } from '@baishou/database-desktop'
import { getAppDb } from '../db'
import { eq, desc, like, sql } from 'drizzle-orm'
import { EMBEDDING_SOURCE_SORT_MILLIS_SQL, timestampToMillis } from '@baishou/shared'
import { getEmbeddingService, getEmbeddingConfig } from './rag.ipc'

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
                const vectorResults = await hybridRepo.queryNativeVector(queryVector, limit)

                const entries = vectorResults.map((r) => ({
                  embeddingId: r.messageId, // ISearchResult では messageId に embeddingId が入っている
                  text: r.chunkText,
                  modelId: config.getGlobalEmbeddingModelId() || 'unknown',
                  createdAt:
                    timestampToMillis(
                      typeof r.createdAt === 'number' ? r.createdAt : undefined
                    ) ?? Date.now(),
                  similarity: r.score // コサイン类似度が score に入っている
                }))

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
      let query = db
        .select({
          embeddingId: memoryEmbeddingsTable.embeddingId,
          text: memoryEmbeddingsTable.chunkText,
          modelId: memoryEmbeddingsTable.modelId,
          sortMillis: embeddingSortMillis
        })
        .from(memoryEmbeddingsTable)

      if (params.keyword && params.keyword.trim() !== '') {
        query = query.where(like(memoryEmbeddingsTable.chunkText, `%${params.keyword}%`)) as typeof query
      }

      const results = await query
        .orderBy(
          sql.raw(`${EMBEDDING_SOURCE_SORT_MILLIS_SQL} DESC`),
          desc(memoryEmbeddingsTable.embeddingId)
        )
        .limit(params.limit || 10)
        .offset(params.offset || 0)

      const entries = results.map((r) => ({
        embeddingId: r.embeddingId,
        text: r.text,
        modelId: r.modelId,
        createdAt: timestampToMillis(Number(r.sortMillis)) ?? Date.now()
      }))

      if (params.withTotal) {
        let total = 0
        if (params.keyword && params.keyword.trim() !== '') {
          const countRes = await db
            .select({ count: sql<number>`count(*)` })
            .from(memoryEmbeddingsTable)
            .where(like(memoryEmbeddingsTable.chunkText, `%${params.keyword}%`))
          total = countRes[0]?.count || 0
        } else {
          const countRes = await db
            .select({ count: sql<number>`count(*)` })
            .from(memoryEmbeddingsTable)
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

    await embeddingService.updateMemoryChunk({
      entry: {
        embedding_id: record.embeddingId,
        source_type: record.sourceType,
        source_id: record.sourceId,
        group_id: record.groupId,
        chunk_index: record.chunkIndex,
        metadata_json: record.metadataJson
      },
      newText: params.newText
    })
    return true
  })
}
