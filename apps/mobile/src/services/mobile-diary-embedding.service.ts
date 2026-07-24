import * as Crypto from 'expo-crypto'
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

import type { AppDatabase } from '@baishou/database'
import { embedDiaryEntry, type MobileRagServiceDeps } from './mobile-rag.service'
import {
  bindMobileDiaryEmbedJobsDb,
  deleteDiaryEmbedJob,
  enqueueDiaryEmbedJob
} from './mobile-diary-embed-jobs.service'
import { resolveEmbeddingAdapter } from './mobile-rag-core.helpers'

const failureListeners = new Set<(message?: string) => void>()
let embeddingDeps: MobileRagServiceDeps | null = null

export function setMobileDiaryEmbeddingDeps(
  deps: MobileRagServiceDeps | null,
  options?: { agentDb?: AppDatabase | null }
): void {
  embeddingDeps = deps
  if (deps === null) {
    bindMobileDiaryEmbedJobsDb(null)
    return
  }
  if (options && 'agentDb' in options) {
    bindMobileDiaryEmbedJobsDb(options.agentDb ?? null)
  }
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

async function md5Hex(content: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.MD5, content)
}

async function resolveVaultName(explicit?: string): Promise<string> {
  const deps = embeddingDeps
  if (explicit?.trim()) return explicit.trim()
  if (deps?.vaultScope) {
    return deps.vaultScope.resolveActiveVaultName()
  }
  return 'Personal'
}

const mobileDiaryEmbeddingCallback: IEmbeddingCallback = {
  async reEmbedDiary(params) {
    const deps = embeddingDeps
    if (!deps) return false

    const vaultName = await resolveVaultName(params.vaultName)
    const contentHash = await md5Hex(params.content)

    try {
      const ragConfig = await loadRagConfig(deps.settingsManager)
      const adapter = await resolveEmbeddingAdapter(deps)

      if (!isRagMemoryEnabled(ragConfig) || !adapter) {
        await enqueueDiaryEmbedJob({
          vaultName,
          diaryId: params.diaryId,
          contentHash
        })
        return false
      }

      await embedDiaryEntry(deps, {
        diaryId: params.diaryId,
        content: params.content,
        tags: params.tags,
        date: params.date,
        updatedAt: params.updatedAt,
        vaultName
      })
      await deleteDiaryEmbedJob(vaultName, params.diaryId)
      const ragConfigAfter = await loadRagConfig(deps.settingsManager)
      if (hasRagDiaryEmbedFailure(ragConfigAfter)) {
        await deps.settingsManager.set('rag_config', clearRagDiaryEmbedFailure(ragConfigAfter))
      }
      return true
    } catch (e) {
      logger.warn('[MobileDiaryEmbed] RAG 嵌入失败', e as Error)
      await enqueueDiaryEmbedJob(
        {
          vaultName,
          diaryId: params.diaryId,
          contentHash
        },
        formatAiApiCallError(e)
      )
      const ragConfig = await loadRagConfig(deps.settingsManager)
      if (!isRagMemoryEnabled(ragConfig)) return false
      const message = formatAiApiCallError(e)
      await deps.settingsManager.set('rag_config', markRagDiaryEmbedFailure(ragConfig, message))
      notifyDiaryEmbedFailure(message)
      return false
    }
  },

  async enqueueDiaryEmbed(params) {
    const vaultName = await resolveVaultName(params.vaultName)
    await enqueueDiaryEmbedJob({
      vaultName,
      diaryId: params.diaryId,
      contentHash: params.contentHash
    })
  },

  async deleteEmbeddingsBySource(sourceType, sourceId) {
    const deps = embeddingDeps
    if (!deps) return
    await deps.hsRepo.deleteEmbeddingsBySource(sourceType, sourceId)
    if (sourceType === 'diary' && sourceId.includes('#')) {
      const [vaultName, idPart] = sourceId.split('#')
      const diaryId = Number(idPart)
      if (vaultName && Number.isFinite(diaryId)) {
        await deleteDiaryEmbedJob(vaultName, diaryId)
      }
    }
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
