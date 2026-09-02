import { KnowledgeReaderAdapter, usableKnowledgeSearchHits } from '@baishou/ai'
import { KnowledgeSearchService, searchMountedKnowledgeNotebooks } from '@baishou/core-desktop'
import {
  EMBEDDING_NOT_CONFIGURED,
  parseMountedNotebookIds,
  type ToolKnowledgeReader
} from '@baishou/shared'
import { KnowledgeRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import { getEmbeddingService, getEmbeddingConfig } from '../ipc/rag.ipc'
import { resolveActiveVaultId } from '../ipc/vault.ipc'

/**
 * Build a ToolKnowledgeReader for companion / workspace chat injection.
 * Returns undefined when knowledge.db is not connected.
 */
export function createDesktopKnowledgeReader(
  embedQuery?: (text: string) => Promise<number[] | null>
): ToolKnowledgeReader | undefined {
  if (!knowledgeConnectionManager.isConnected()) return undefined

  const repo = new KnowledgeRepository(knowledgeConnectionManager.getDb())
  const sqlite = knowledgeConnectionManager.getSqlite()
  const search = new KnowledgeSearchService({
    sql: {
      all: (sql, params = []) =>
        sqlite.prepare(sql).all(...params) as Array<Record<string, unknown>>
    },
    getSourceTitle: async (sourceId) => {
      const row = await repo.getSource(sourceId)
      return row?.title ?? null
    }
  })

  const resolveEmbed =
    embedQuery ??
    (async (text: string) => {
      try {
        return await getEmbeddingService().embedQuery(text)
      } catch {
        return null
      }
    })

  return new KnowledgeReaderAdapter(async (opts) => {
    const notebookIds = parseMountedNotebookIds(opts.notebookIds)
    if (notebookIds.length === 0) return []

    const embeddingConfig = getEmbeddingConfig()
    await embeddingConfig.load()
    const modelId = embeddingConfig.getGlobalEmbeddingModelId()
    const vaultId = resolveActiveVaultId()
    const profiles = await repo.listNotebookEmbeddingProfiles({ vaultId, notebookIds })

    const queryVector = await resolveEmbed(opts.query)
    if (!queryVector?.length) {
      throw new Error(EMBEDDING_NOT_CONFIGURED)
    }

    const hits = await searchMountedKnowledgeNotebooks({
      query: opts.query,
      notebookIds,
      queryVector,
      currentModelId: modelId,
      profiles,
      search,
      limit: opts.limit,
      limitPerNotebook: opts.limitPerNotebook
    })
    return usableKnowledgeSearchHits(hits)
  })
}
