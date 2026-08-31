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

  if (configured && embeddingProvider && embeddingModelId && connectionManager.isConnected()) {
    const hsRepo = new SqliteHybridSearchRepository(
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

  try {
    const records = await getActiveVaultShadowRepo().getAllRecords()
    for (const row of records) {
      diaryIdByPath.set(normalizeGraphFilePath(row.filePath), String(row.id))
    }
  } catch {
    // Shadow index may be unavailable during early boot.
  }

  return {
    embedQuery,
    modelId,
    isEmbeddingConfigured: () => Boolean(configured && embedQuery),
    isDiaryEmbedded: (filePath) => {
      const diaryId = diaryIdByPath.get(normalizeGraphFilePath(filePath))
      if (!diaryId) return false
      return isDiaryEmbeddingPresent(vaultId, diaryId, embeddedSourceIds)
    }
  }
}
