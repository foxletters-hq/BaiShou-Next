import { ipcMain } from 'electron'
import { EmbeddingService } from '@baishou/ai/src/rag/embedding.service'
import { IEmbeddingConfig } from '@baishou/ai/src/rag/embedding.types'
import { settingsManager } from './settings.ipc'
import { DesktopEmbeddingStorage } from './rag.storage'
import { getDiaryManager } from './diary.ipc'
import { getAppDb } from '../db'
import { memoryEmbeddingsTable, SqliteHybridSearchRepository } from '@baishou/database'
import { eq, sql, desc, like } from 'drizzle-orm'
import { AIProviderConfig } from '@baishou/shared'

class DesktopEmbeddingConfig implements IEmbeddingConfig {
  private _cachedConfig: any = {}

  async load() {
    this._cachedConfig = (await settingsManager.get<any>('global_models')) || {}
  }

  getGlobalEmbeddingModelId(): string {
    return this._cachedConfig.globalEmbeddingModelId || ''
  }
  getGlobalEmbeddingProviderId(): string {
    return this._cachedConfig.globalEmbeddingProviderId || ''
  }
  getGlobalEmbeddingDimension(): number {
    return this._cachedConfig.globalEmbeddingDimension || 0
  }
  async setGlobalEmbeddingDimension(dimension: number): Promise<void> {
    const config = (await settingsManager.get<any>('global_models')) || {}
    config.globalEmbeddingDimension = dimension
    await settingsManager.set('global_models', config)
    this._cachedConfig = config
  }
  async getProviderInstance(): Promise<any> {
    const providerId = this.getGlobalEmbeddingProviderId()
    if (!providerId) return null

    const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
    const pConfig = providers.find((p) => p.id === providerId)
    if (!pConfig) return null

    const { AIProviderRegistry } = await import('@baishou/ai/src/providers/provider.registry')
    return AIProviderRegistry.getInstance().getOrUpdateProvider(pConfig)
  }
}

export function filterUnindexedDiaries<T extends { id: any; updatedAt?: Date }>(
  diaries: T[],
  embeddedIds: Set<string>,
  embeddedUpdatedAtMap: Map<string, number>
): T[] {
  return diaries.filter((d) => {
    const sId = String(d.id)
    // 1. 如果向量库里没有该日记，判定为未索引，需要嵌入
    if (!embeddedIds.has(sId)) {
      return true
    }
    // 2. 如果已存在向量记录，且能提取出 recorded updatedAt
    const existingUpdatedAt = embeddedUpdatedAtMap.get(sId)
    if (existingUpdatedAt !== undefined && d.updatedAt) {
      // 若日记最新的更新时间晚于向量库中存储的更新时间，说明日记被修改过，需要重新嵌入
      return d.updatedAt.getTime() > existingUpdatedAt
    }
    // 3. 若已存在向量记录但无 metadata.updated_at 历史元数据，默认判定为已索引跳过，防止重复扫描
    return false
  })
}

export function registerRagIPC() {
  const config = new DesktopEmbeddingConfig()
  const storage = new DesktopEmbeddingStorage()
  const embeddingService = new EmbeddingService(config, storage)

  ipcMain.handle('rag:get-stats', async () => {
    await config.load()
    const db = getAppDb()
    const countRes = await db.select({ count: sql<number>`count(*)` }).from(memoryEmbeddingsTable)
    const count = countRes[0]?.count || 0

    return {
      totalCount: count,
      currentDimension: config.getGlobalEmbeddingDimension(),
      totalSizeText: `${(count * 2.5).toFixed(1)} KB` // Mock size calc for UI
    }
  })

  ipcMain.handle('rag:detect-dimension', async () => {
    await config.load()
    return await embeddingService.detectDimension()
  })

  ipcMain.handle('rag:clear-dimension', async () => {
    await config.load()
    await storage.clearEmbeddings()
    await config.setGlobalEmbeddingDimension(0)
    return true
  })

  ipcMain.handle('rag:clear-all', async () => {
    await config.load()
    await storage.clearEmbeddings()
    await config.setGlobalEmbeddingDimension(0)
    return true
  })

  ipcMain.handle('rag:trigger-batch-embed', async (event) => {
    await config.load()
    try {
      const db = getAppDb()
      const diaries = await getDiaryManager().listAll({ limit: 10000 })

      // 查询 memory_embeddings 中已有的日记嵌入记录，读取 metadataJson 提取已有的更新时间
      const existingRows = await db
        .select({
          sourceId: memoryEmbeddingsTable.sourceId,
          metadataJson: memoryEmbeddingsTable.metadataJson
        })
        .from(memoryEmbeddingsTable)
        .where(eq(memoryEmbeddingsTable.sourceType, 'diary'))

      const embeddedIds = new Set(existingRows.map((row) => row.sourceId))
      const embeddedUpdatedAtMap = new Map<string, number>()

      for (const row of existingRows) {
        if (!row.metadataJson) continue
        try {
          const meta = JSON.parse(row.metadataJson)
          if (meta && typeof meta.updated_at === 'number') {
            const currentMax = embeddedUpdatedAtMap.get(row.sourceId) ?? 0
            if (meta.updated_at > currentMax) {
              embeddedUpdatedAtMap.set(row.sourceId, meta.updated_at)
            }
          }
        } catch {}
      }

      // 过滤：仅嵌入从未被索引过，或者已被索引但又发生修改的日记
      const diariesToEmbed = filterUnindexedDiaries(diaries, embeddedIds, embeddedUpdatedAtMap)

      let progress = 0

      for (const meta of diariesToEmbed) {
        progress++
        event.sender.send('agent:rag-progress', {
          isRunning: true,
          type: 'batchEmbed',
          progress,
          total: diariesToEmbed.length,
          statusText: `处理日记: ${new Date(meta.date).toLocaleDateString()}`
        })

        const diary = await getDiaryManager().findById(meta.id)
        if (!diary || !diary.id || !diary.content || !diary.content.trim()) continue

        // 构建 chunkPrefix：标签 + 日期上下文，与原版白守对齐
        const d = meta.date
        const dateLabel = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const tagPrefix = meta.tags.length > 0 ? `[标签: ${meta.tags.join(', ')}] ` : ''

        await embeddingService.reEmbedText({
          text: diary.content,
          sourceType: 'diary',
          sourceId: diary.id.toString(),
          groupId: 'diary_batch',
          chunkPrefix: `${tagPrefix}[${dateLabel} 日记:]\n`,
          metadataJson: JSON.stringify({ updated_at: diary.updatedAt?.getTime() ?? Date.now() }),
          sourceCreatedAt: diary.date.getTime()
        })
      }

      event.sender.send('agent:rag-progress', {
        isRunning: false,
        progress: diariesToEmbed.length,
        total: diariesToEmbed.length,
        type: 'idle'
      })
      return true
    } catch (e: any) {
      console.error('Batch Embed failed:', e)
      event.sender.send('agent:rag-progress', { isRunning: false, type: 'idle' })
      throw e
    }
  })

  ipcMain.handle('rag:add-manual-memory', async (_, text: string) => {
    await config.load()
    if (!text || !text.trim()) return false

    await embeddingService.embedText({
      text,
      sourceType: 'manual',
      sourceId: `manual_${Date.now()}`,
      groupId: 'manual',
      sourceCreatedAt: Date.now()
    })
    return true
  })

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
                  createdAt: r.createdAt || Date.now(),
                  similarity: r.score // コサイン類似度が score に入っている
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
      const query = db.select().from(memoryEmbeddingsTable)

      if (params.keyword && params.keyword.trim() !== '') {
        query.where(like(memoryEmbeddingsTable.chunkText, `%${params.keyword}%`))
      }

      const results = await query
        .orderBy(desc(memoryEmbeddingsTable.createdAt))
        .limit(params.limit || 10)
        .offset(params.offset || 0)

      const entries = results.map((r) => ({
        embeddingId: r.embeddingId,
        text: r.chunkText,
        modelId: r.modelId,
        createdAt: r.createdAt?.getTime() || 0
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

  ipcMain.handle('rag:trigger-migration', async (event) => {
    await config.load()
    try {
      const generator = embeddingService.migrateEmbeddings()
      for await (const state of generator) {
        event.sender.send('agent:rag-progress', {
          isRunning: true,
          type: 'migration',
          progress: state.completed,
          total: state.total,
          statusText: state.status
        })
      }
      event.sender.send('agent:rag-progress', {
        isRunning: false,
        progress: 0,
        total: 0,
        type: 'idle'
      })
      return true
    } catch (e: any) {
      console.error('Migration failed:', e)
      event.sender.send('agent:rag-progress', { isRunning: false, type: 'idle' })
      throw e
    }
  })

  ipcMain.handle('rag:has-pending-migration', async () => {
    await config.load()
    return await embeddingService.hasPendingMigration()
  })

  ipcMain.handle('rag:has-model-mismatch', async () => {
    await config.load()
    return await embeddingService.hasHeterogeneousEmbeddings()
  })
}
