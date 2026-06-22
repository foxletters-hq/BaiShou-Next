import type { IEmbeddingCallback } from '@baishou/core-mobile'
import { isRagMemoryEnabled, logger } from '@baishou/shared'

import { embedDiaryEntry, type MobileRagServiceDeps } from './mobile-rag.service'

const failureListeners = new Set<() => void>()
let embeddingDeps: MobileRagServiceDeps | null = null

export function setMobileDiaryEmbeddingDeps(deps: MobileRagServiceDeps | null): void {
  embeddingDeps = deps
}

export function getMobileDiaryEmbeddingDeps(): MobileRagServiceDeps | null {
  return embeddingDeps
}

export function subscribeDiaryEmbedFailure(listener: () => void): () => void {
  failureListeners.add(listener)
  return () => {
    failureListeners.delete(listener)
  }
}

export function notifyDiaryEmbedFailure(): void {
  for (const listener of failureListeners) {
    try {
      listener()
    } catch {
      /* ignore */
    }
  }
}

const mobileDiaryEmbeddingCallback: IEmbeddingCallback = {
  async reEmbedDiary(params) {
    const deps = embeddingDeps
    if (!deps) return

    try {
      await embedDiaryEntry(deps, {
        diaryId: params.diaryId,
        content: params.content,
        tags: params.tags,
        date: params.date,
        updatedAt: params.updatedAt,
        groupId: 'diary_auto'
      })
    } catch (e) {
      logger.warn('[MobileDiaryEmbed] RAG 嵌入失败', e as Error)
      const ragConfig =
        (await deps.settingsManager.get<{ ragEnabled?: boolean }>('rag_config')) || {}
      if (!isRagMemoryEnabled({ ragEnabled: ragConfig.ragEnabled ?? true })) return
      notifyDiaryEmbedFailure()
    }
  },

  async deleteEmbeddingsBySource(sourceType, sourceId) {
    const deps = embeddingDeps
    if (!deps) return
    await deps.hsRepo.deleteEmbeddingsBySource(sourceType, sourceId)
  }
}

export function getMobileDiaryEmbeddingCallback(): IEmbeddingCallback {
  return mobileDiaryEmbeddingCallback
}
