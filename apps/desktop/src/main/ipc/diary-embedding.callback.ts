import { createHash } from 'node:crypto'
import { BrowserWindow } from 'electron'
import type { IEmbeddingCallback } from '@baishou/core-desktop'
import {
  buildDiaryEmbeddingGroupId,
  buildDiaryEmbeddingSourceId,
  diaryDateToSourceCreatedSeconds,
  formatAiApiCallError,
  isRagMemoryEnabled,
  markRagDiaryEmbedFailure,
  clearRagDiaryEmbedFailure,
  hasRagDiaryEmbedFailure,
  buildDiaryEmbeddingTagPrefix
} from '@baishou/shared'

import { vaultService } from './vault.ipc'
import { deleteDiaryEmbeddingAliases } from '../services/diary-embedding.util'
import { deleteDiaryEmbedJob, enqueueDiaryEmbedJob } from '../services/diary-embed-jobs.service'

function broadcastDiaryEmbedFailed(message: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('diary:sync-event', { type: 'embed-failed', message })
  }
}

async function persistDiaryEmbedFailure(error: unknown): Promise<void> {
  const { settingsManager } = await import('./settings.ipc')
  const ragConfig = (await settingsManager.get<any>('rag_config')) || {}
  if (!isRagMemoryEnabled(ragConfig)) return
  const message = formatAiApiCallError(error)
  await settingsManager.set('rag_config', markRagDiaryEmbedFailure(ragConfig, message))
  broadcastDiaryEmbedFailed(message)
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

function resolveVaultName(explicit?: string): string {
  return explicit?.trim() || vaultService.getActiveVault()?.name || 'Personal'
}

export const embeddingCallback: IEmbeddingCallback = {
  async reEmbedDiary(params) {
    const vaultName = resolveVaultName(params.vaultName)
    const contentHash = createHash('md5').update(params.content, 'utf8').digest('hex')
    try {
      const { settingsManager } = await import('./settings.ipc')
      const ragConfig = (await settingsManager.get<any>('rag_config')) || {}

      const { getEmbeddingService } = await import('./rag.ipc')
      const embeddingService = getEmbeddingService()

      if (!isRagMemoryEnabled(ragConfig) || !embeddingService.isConfigured) {
        await enqueueDiaryEmbedJob({
          vaultName,
          diaryId: params.diaryId,
          contentHash
        })
        return false
      }

      const d = new Date(params.date)
      const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const tagPrefix = buildDiaryEmbeddingTagPrefix(params.tags)

      const sourceId = buildDiaryEmbeddingSourceId(vaultName, params.diaryId)

      await deleteDiaryEmbeddingAliases(vaultName, params.diaryId)
      await embeddingService.reEmbedText({
        text: params.content,
        sourceType: 'diary',
        sourceId,
        groupId: buildDiaryEmbeddingGroupId(vaultName),
        chunkPrefix: `${tagPrefix}[${label} 日记:]\n`,
        metadataJson: JSON.stringify({ updated_at: params.updatedAt.getTime() }),
        sourceCreatedAt: diaryDateToSourceCreatedSeconds(d) * 1000
      })
      await deleteDiaryEmbedJob(vaultName, params.diaryId)
      await clearDiaryEmbedFailureIfSet()
      return true
    } catch (e: any) {
      console.error('[DiaryIPC] RAG 嵌入发生异常:', e)
      await enqueueDiaryEmbedJob(
        {
          vaultName,
          diaryId: params.diaryId,
          contentHash
        },
        formatAiApiCallError(e)
      )
      await persistDiaryEmbedFailure(e)
      return false
    }
  },

  async enqueueDiaryEmbed(params) {
    const vaultName = resolveVaultName(params.vaultName)
    await enqueueDiaryEmbedJob({
      vaultName,
      diaryId: params.diaryId,
      contentHash: params.contentHash
    })
  },

  async deleteEmbeddingsBySource(sourceType, sourceId) {
    try {
      const { DesktopEmbeddingStorage } = await import('./rag.storage')
      const storage = new DesktopEmbeddingStorage()
      await storage.deleteEmbeddingsBySource(sourceType, sourceId)
      if (sourceType === 'diary' && sourceId.includes('#')) {
        const [vaultName, idPart] = sourceId.split('#')
        const diaryId = Number(idPart)
        if (vaultName && Number.isFinite(diaryId)) {
          await deleteDiaryEmbedJob(vaultName, diaryId)
        }
      }
    } catch (e: any) {
      console.error('[DiaryIPC] RAG 清理发生异常:', e)
    }
  }
}
