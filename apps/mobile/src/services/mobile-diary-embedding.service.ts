import type { IEmbeddingCallback } from '@baishou/core-mobile'
import {
  formatAiApiCallError,
  isRagMemoryEnabled,
  markRagDiaryEmbedFailure,
  clearRagDiaryEmbedFailure,
  hasRagDiaryEmbedFailure,
  logger,
  type RagConfig
} from '@baishou/shared'

import { embedDiaryEntry, type MobileRagServiceDeps } from './mobile-rag.service'

const failureListeners = new Set<(message?: string) => void>()
let embeddingDeps: MobileRagServiceDeps | null = null

export function setMobileDiaryEmbeddingDeps(deps: MobileRagServiceDeps | null): void {
  embeddingDeps = deps
}

export function getMobileDiaryEmbeddingDeps(): MobileRagServiceDeps | null {
  return embeddingDeps
}

export function subscribeDiaryEmbedFailure(listener: (message?: string) => void): () => void {
  failureListeners.add(listener)
  return () => {
    failureListeners.delete(listener)
  }
}

export function notifyDiaryEmbedFailure(message?: string): void {
  for (const listener of failureListeners) {
    try {
      listener(message)
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
      const vaultName = deps.vaultScope
        ? await deps.vaultScope.resolveActiveVaultName()
        : 'Personal'
      await embedDiaryEntry(deps, {
        diaryId: params.diaryId,
        content: params.content,
        tags: params.tags,
        date: params.date,
        updatedAt: params.updatedAt,
        vaultName
      })
      const ragConfigAfter = await loadRagConfig(deps.settingsManager)
      if (hasRagDiaryEmbedFailure(ragConfigAfter)) {
        await deps.settingsManager.set('rag_config', clearRagDiaryEmbedFailure(ragConfigAfter))
      }
    } catch (e) {
      logger.warn('[MobileDiaryEmbed] RAG 嵌入失败', e as Error)
      const ragConfig = await loadRagConfig(deps.settingsManager)
      if (!isRagMemoryEnabled(ragConfig)) return
      const message = formatAiApiCallError(e)
      await deps.settingsManager.set('rag_config', markRagDiaryEmbedFailure(ragConfig, message))
      notifyDiaryEmbedFailure(message)
    }
  },

  async deleteEmbeddingsBySource(sourceType, sourceId) {
    const deps = embeddingDeps
    if (!deps) return
    await deps.hsRepo.deleteEmbeddingsBySource(sourceType, sourceId)
  }
}

const DEFAULT_RAG_CONFIG: RagConfig = {
  ragEnabled: true,
  ragTopK: 20,
  ragSimilarityThreshold: 0.4
}

async function loadRagConfig(
  settingsManager: NonNullable<MobileRagServiceDeps['settingsManager']>
): Promise<RagConfig> {
  const stored = await settingsManager.get<Partial<RagConfig>>('rag_config')
  return { ...DEFAULT_RAG_CONFIG, ...stored }
}

export function getMobileDiaryEmbeddingCallback(): IEmbeddingCallback {
  return mobileDiaryEmbeddingCallback
}
