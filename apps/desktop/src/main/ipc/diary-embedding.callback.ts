import { BrowserWindow } from 'electron'
import type { IEmbeddingCallback } from '@baishou/core-desktop'
import {
  diaryDateToSourceCreatedSeconds,
  markRagDiaryEmbedFailure,
  clearRagDiaryEmbedFailure,
  hasRagDiaryEmbedFailure
} from '@baishou/shared'

function broadcastDiaryEmbedFailed(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('diary:sync-event', { type: 'embed-failed' })
  }
}

async function persistDiaryEmbedFailure(): Promise<void> {
  const { settingsManager } = await import('./settings.ipc')
  const ragConfig = (await settingsManager.get<any>('rag_config')) || {}
  await settingsManager.set('rag_config', markRagDiaryEmbedFailure(ragConfig))
  broadcastDiaryEmbedFailed()
}

async function clearDiaryEmbedFailureIfSet(): Promise<void> {
  const { settingsManager } = await import('./settings.ipc')
  const ragConfig = (await settingsManager.get<any>('rag_config')) || {}
  if (!hasRagDiaryEmbedFailure(ragConfig)) return
  await settingsManager.set('rag_config', clearRagDiaryEmbedFailure(ragConfig))
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('diary:sync-event', { type: 'embed-failure-cleared' })
  }
}

export const embeddingCallback: IEmbeddingCallback = {
  async reEmbedDiary(params) {
    try {
      const { settingsManager } = await import('./settings.ipc')
      const ragConfig = (await settingsManager.get<any>('rag_config')) || {}
      const ragEnabled = ragConfig.ragEnabled ?? true

      const { getEmbeddingService } = await import('./rag.ipc')
      const embeddingService = getEmbeddingService()

      if (!ragEnabled || !embeddingService.isConfigured) {
        return
      }

      const d = new Date(params.date)
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const tagPrefix = params.tags.length > 0 ? `[标签: ${params.tags.join(', ')}] ` : ''

      await embeddingService.reEmbedText({
        text: params.content,
        sourceType: 'diary',
        sourceId: params.diaryId.toString(),
        groupId: 'diary_auto',
        chunkPrefix: `${tagPrefix}[${label} 日记:]\n`,
        metadataJson: JSON.stringify({ updated_at: params.updatedAt.getTime() }),
        sourceCreatedAt: diaryDateToSourceCreatedSeconds(d) * 1000
      })
      await clearDiaryEmbedFailureIfSet()
    } catch (e: any) {
      console.error('[DiaryIPC] RAG 嵌入发生异常:', e)
      await persistDiaryEmbedFailure()
    }
  },

  async deleteEmbeddingsBySource(sourceType, sourceId) {
    try {
      const { DesktopEmbeddingStorage } = await import('./rag.storage')
      const storage = new DesktopEmbeddingStorage()
      await storage.deleteEmbeddingsBySource(sourceType, sourceId)
    } catch (e: any) {
      console.error('[DiaryIPC] RAG 清理发生异常:', e)
    }
  }
}
