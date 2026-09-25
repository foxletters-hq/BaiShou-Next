import { EMBEDDING_NOT_CONFIGURED } from '@baishou/shared'
import { getEmbeddingService } from './rag.ipc'
import {
  assertKnowledgeModelMatch,
  buildSearchService,
  handleKnowledgeIpc,
  requireActiveVaultId,
  requireKnowledgeRepo
} from './knowledge-ipc.context'

export function registerKnowledgeSearchIpc(): void {
  handleKnowledgeIpc('knowledge:get-stats', async (_e, notebookId?: string) => {
    const repo = requireKnowledgeRepo()
    return repo.getStats(notebookId, requireActiveVaultId())
  })

  handleKnowledgeIpc('knowledge:has-model-mismatch', async (_e, notebookIds?: string[]) => {
    const repo = requireKnowledgeRepo()
    const embeddingService = getEmbeddingService()
    const { getEmbeddingConfig } = await import('./rag.ipc')
    const embeddingConfig = getEmbeddingConfig()
    await embeddingConfig.load()
    const modelId = embeddingConfig.getGlobalEmbeddingModelId()
    if (!modelId || !embeddingService.isConfigured) return false
    const vaultId = requireActiveVaultId()
    const ids = (notebookIds ?? []).map((id) => String(id).trim()).filter(Boolean)
    const count = await repo.countHeterogeneousEmbeddings(modelId, {
      vaultId,
      ...(ids.length > 0 ? { notebookIds: ids } : {})
    })
    return count > 0
  })

  handleKnowledgeIpc('knowledge:list-sources', async (_e, notebookId: string) => {
    const repo = requireKnowledgeRepo()
    return repo.listSources(notebookId)
  })

  handleKnowledgeIpc(
    'knowledge:list-chunks',
    async (_e, input: { notebookId: string; limit?: number; offset?: number; query?: string }) => {
      const notebookId = String(input?.notebookId || '').trim()
      if (!notebookId) throw new Error('notebookId required')
      const repo = requireKnowledgeRepo()
      return repo.listChunksByNotebook({
        notebookId,
        limit: input.limit,
        offset: input.offset,
        query: input.query
      })
    }
  )

  handleKnowledgeIpc(
    'knowledge:search',
    async (_e, input: { notebookId: string; query: string; topK?: number }) => {
      const repo = requireKnowledgeRepo()
      await assertKnowledgeModelMatch(repo, [input.notebookId])
      const embeddingService = getEmbeddingService()
      if (!embeddingService.isConfigured) {
        throw new Error(EMBEDDING_NOT_CONFIGURED)
      }
      const queryVector = await embeddingService.embedQuery(input.query)
      if (!queryVector?.length) {
        throw new Error('查询嵌入失败：未得到向量')
      }
      const search = buildSearchService()
      return search.search({
        notebookId: input.notebookId,
        query: input.query,
        queryVector,
        topK: input.topK
      })
    }
  )
}
