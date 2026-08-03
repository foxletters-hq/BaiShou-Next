import { KnowledgeReaderAdapter } from '@baishou/ai'
import { KnowledgeSearchService } from '@baishou/core-desktop'
import type { ToolKnowledgeReader } from '@baishou/shared'
import { KnowledgeRepository, knowledgeConnectionManager } from '@baishou/database-desktop'
import { getEmbeddingService, getEmbeddingConfig } from '../ipc/rag.ipc'
import { resolveActiveVaultId } from '../ipc/vault.ipc'

/**
 * Build a ToolKnowledgeReader for companion / workspace chat injection.
 * Returns undefined when knowledge.db is not connected.
 * Shares Ask 的 model-mismatch 硬闸门。
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
    const embeddingConfig = getEmbeddingConfig()
    await embeddingConfig.load()
    const modelId = embeddingConfig.getGlobalEmbeddingModelId()
    const embeddingService = getEmbeddingService()
    if (modelId && embeddingService.isConfigured) {
      const vaultId = resolveActiveVaultId()
      const mismatch = await repo.countHeterogeneousEmbeddings(modelId, { vaultId })
      if (mismatch > 0) {
        throw new Error('knowledge-model-mismatch')
      }
    }

    const queryVector = await resolveEmbed(opts.query)
    if (!queryVector?.length) {
      throw new Error('embedding-not-configured')
    }
    const hits = await search.search({
      notebookId: opts.notebookId,
      query: opts.query,
      queryVector,
      topK: opts.limit
    })
    return hits.map((h) => ({
      chunkId: h.chunkId,
      sourceId: h.sourceId,
      notebookId: h.notebookId,
      chunkIndex: h.chunkIndex,
      chunkText: h.chunkText,
      score: h.score,
      title: h.title,
      offset: h.offset,
      len: h.len
    }))
  })
}
