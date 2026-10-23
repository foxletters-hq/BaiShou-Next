import { BrowserWindow } from 'electron'
import type { IEmbeddingCallback } from '@baishou/core-desktop'
import {
  formatAiApiCallError,
  hashEmbedSourceContent,
  isRagMemoryEnabled,
  markRagDiaryEmbedFailure,
  clearRagDiaryEmbedFailure,
  hasRagDiaryEmbedFailure
} from '@baishou/shared'
import { buildDesktopDiaryReEmbedArgs } from '../services/diary-embed-text.util'

import { vaultService, resolveActiveVaultId, resolveVaultIdByName } from './vault.ipc'
import { deleteDiaryEmbeddingAliases } from '../services/diary-embedding.util'

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

function resolveVaultId(explicit?: string): string {
  if (explicit?.trim()) {
    const trimmed = explicit.trim()
    const fromRegistry = vaultService
      .getAllVaults()
      .find((v) => v.id === trimmed || v.name === trimmed)
    return fromRegistry?.id ?? resolveVaultIdByName(trimmed)
  }
  return resolveActiveVaultId()
}

export const embeddingCallback: IEmbeddingCallback = {
  async reEmbedDiary(params) {
    const vaultId = resolveVaultId(params.vaultName)
    const contentHash = hashEmbedSourceContent(params.content)
    try {
      const { settingsManager } = await import('./settings.ipc')
      const ragConfig = (await settingsManager.get<any>('rag_config')) || {}

      const { getEmbeddingService } = await import('./rag.ipc')
      const embeddingService = getEmbeddingService()

      if (!isRagMemoryEnabled(ragConfig) || !embeddingService.isConfigured) {
        return false
      }

      await deleteDiaryEmbeddingAliases(vaultId, params.diaryId)
      await embeddingService.reEmbedText(
        buildDesktopDiaryReEmbedArgs({
          content: params.content,
          date: params.date,
          vaultId,
          diaryId: params.diaryId,
          updatedAt: params.updatedAt,
          contentHash
        })
      )
      await clearDiaryEmbedFailureIfSet()
      const { invalidatePendingEmbedCountsCache } =
        await import('../services/pending-embed-counts.service')
      invalidatePendingEmbedCountsCache()
      try {
        const { scheduleDiaryGraphAfterEmbed } =
          await import('../services/diary-graph-follow-after-embed.service')
        await scheduleDiaryGraphAfterEmbed({
          vaultId,
          diaryId: params.diaryId,
          contentHash
        })
      } catch {
        /* 接续失败不回滚已完成的向量 */
      }
      return true
    } catch (e: any) {
      console.error('[DiaryIPC] RAG 嵌入发生异常:', e)
      await persistDiaryEmbedFailure(e)
      return false
    }
  },

  async enqueueDiaryEmbed(_params) {
    // diary_embed_jobs 已退休：待嵌入由账本检测，不再入队
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
