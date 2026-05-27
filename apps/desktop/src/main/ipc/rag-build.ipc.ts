import { ipcMain } from 'electron'
import { memoryEmbeddingsTable } from '@baishou/database'
import { getAppDb } from '../db'
import { eq, sql } from 'drizzle-orm'
import { getDiaryManager } from './diary.ipc'
import { getEmbeddingService, getEmbeddingConfig, filterUnindexedDiaries } from './rag.ipc'

export function registerRagBuildIPC() {
  const config = getEmbeddingConfig()
  const embeddingService = getEmbeddingService()

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
    const { DesktopEmbeddingStorage } = await import('./rag.storage')
    const storage = new DesktopEmbeddingStorage()
    await storage.clearEmbeddings()
    await config.setGlobalEmbeddingDimension(0)
    return true
  })

  ipcMain.handle('rag:clear-all', async () => {
    await config.load()
    const { DesktopEmbeddingStorage } = await import('./rag.storage')
    const storage = new DesktopEmbeddingStorage()
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
