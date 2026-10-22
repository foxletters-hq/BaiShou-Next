import type { GraphExtractAlignDeps } from '@baishou/core-desktop'
import { EmbeddingAdapter } from '@baishou/ai'
import {
  connectionManager,
  createSqlExecutorFromDrizzleDb,
  SqliteHybridSearchRepository
} from '@baishou/database-desktop'
import {
  DIARY_EMBED_GROUP_ID,
  isDiaryEmbeddingPresent,
  normalizeGraphFilePath
} from '@baishou/shared'
import { resolveEmbeddingSystemModels } from '../ipc/agent-helpers'
import { getActiveVaultShadowRepo } from '../ipc/vault.ipc'

export async function resolveDesktopGraphExtractAlignDeps(
  vaultId: string
): Promise<GraphExtractAlignDeps> {
  const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()
  const configured = Boolean(embeddingProvider && embeddingModelId)
  let embedQuery: GraphExtractAlignDeps['embedQuery']
  let modelId: string | undefined
  const embeddedSourceIds = new Set<string>()
  const diaryIdByPath = new Map<string, string>()

  let hsRepo: SqliteHybridSearchRepository | null = null
  if (configured && embeddingProvider && embeddingModelId && connectionManager.isConnected()) {
    hsRepo = new SqliteHybridSearchRepository(
      createSqlExecutorFromDrizzleDb(connectionManager.getDb())
    )
    const adapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
    if (adapter.isConfigured) {
      embedQuery = (text) => adapter.embedQuery(text)
      modelId = adapter.embeddingModelId
    }
    const sourceIds = await hsRepo.listSourceIdsByType('diary', {
      vaultId,
      groupId: DIARY_EMBED_GROUP_ID
    })
    for (const id of sourceIds) embeddedSourceIds.add(id)
  }

  let lastShadowRefreshAt = 0
  let lastEmbedRefreshAt = 0
  const REFRESH_COOLDOWN_MS = 1500

  const refreshShadowDiaryMap = async (force = false) => {
    const now = Date.now()
    if (!force && now - lastShadowRefreshAt < REFRESH_COOLDOWN_MS) return
    lastShadowRefreshAt = now
    try {
      const records = await getActiveVaultShadowRepo().getAllRecords()
      for (const row of records) {
        diaryIdByPath.set(normalizeGraphFilePath(row.filePath), String(row.id))
      }
    } catch {
      // Shadow index may be unavailable during early boot.
    }
  }

  const refreshEmbeddedSourceIds = async () => {
    const now = Date.now()
    if (now - lastEmbedRefreshAt < REFRESH_COOLDOWN_MS) return
    lastEmbedRefreshAt = now
    try {
      if (!hsRepo && connectionManager.isConnected()) {
        hsRepo = new SqliteHybridSearchRepository(
          createSqlExecutorFromDrizzleDb(connectionManager.getDb())
        )
      }
      if (!hsRepo) return
      const sourceIds = await hsRepo.listSourceIdsByType('diary', {
        vaultId,
        groupId: DIARY_EMBED_GROUP_ID
      })
      for (const id of sourceIds) embeddedSourceIds.add(id)
    } catch {
      // ignore
    }
  }

  await refreshShadowDiaryMap(true)

  return {
    embedQuery,
    modelId,
    isEmbeddingConfigured: () => Boolean(configured && embedQuery),
    isDiaryEmbedded: async (filePath) => {
      const normalized = normalizeGraphFilePath(filePath)
      let diaryId = diaryIdByPath.get(normalized)
      if (!diaryId) {
        await refreshShadowDiaryMap()
        diaryId = diaryIdByPath.get(normalized)
      }
      if (!diaryId) return false
      if (isDiaryEmbeddingPresent(vaultId, diaryId, embeddedSourceIds)) {
        return true
      }
      await refreshEmbeddedSourceIds()
      return isDiaryEmbeddingPresent(vaultId, diaryId, embeddedSourceIds)
    }
  }
}
