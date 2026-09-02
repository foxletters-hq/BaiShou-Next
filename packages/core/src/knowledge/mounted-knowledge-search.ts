import {
  KNOWLEDGE_PER_NOTEBOOK_HIT_LIMIT,
  KNOWLEDGE_TOTAL_HIT_LIMIT,
  assertCompatibleNotebookDimensions,
  assertMountedNotebookModelMatch,
  parseMountedNotebookIds,
  type NotebookEmbeddingProfile,
  type ToolKnowledgeSearchHit
} from '@baishou/shared'
import type { KnowledgeSearchService } from './knowledge-search.service'

export async function searchMountedKnowledgeNotebooks(opts: {
  query: string
  notebookIds: string[]
  queryVector: number[]
  currentModelId?: string
  profiles: NotebookEmbeddingProfile[]
  search: KnowledgeSearchService
  limit?: number
  limitPerNotebook?: number
}): Promise<ToolKnowledgeSearchHit[]> {
  const notebookIds = parseMountedNotebookIds(opts.notebookIds)
  if (notebookIds.length === 0) return []

  const scopedProfiles = opts.profiles.filter((row) => notebookIds.includes(row.notebookId))
  assertCompatibleNotebookDimensions(scopedProfiles)
  assertMountedNotebookModelMatch(scopedProfiles, opts.currentModelId)

  const nameById = new Map(scopedProfiles.map((row) => [row.notebookId, row.notebookName || row.notebookId]))
  const perNotebook = Math.max(
    1,
    opts.limitPerNotebook ??
      Math.min(
        KNOWLEDGE_PER_NOTEBOOK_HIT_LIMIT,
        Math.ceil((opts.limit ?? KNOWLEDGE_TOTAL_HIT_LIMIT) / notebookIds.length)
      )
  )
  const totalLimit = Math.min(opts.limit ?? KNOWLEDGE_TOTAL_HIT_LIMIT, KNOWLEDGE_TOTAL_HIT_LIMIT)

  const grouped: ToolKnowledgeSearchHit[] = []
  for (const notebookId of notebookIds) {
    if (grouped.length >= totalLimit) break
    const remain = totalLimit - grouped.length
    const hits = await opts.search.search({
      notebookId,
      query: opts.query,
      queryVector: opts.queryVector,
      topK: Math.min(perNotebook, remain)
    })
    for (const hit of hits) {
      grouped.push({
        chunkId: hit.chunkId,
        sourceId: hit.sourceId,
        notebookId: hit.notebookId,
        notebookName: nameById.get(hit.notebookId) || hit.notebookId,
        chunkIndex: hit.chunkIndex,
        chunkText: hit.chunkText,
        score: hit.score,
        title: hit.title,
        offset: hit.offset,
        len: hit.len
      })
    }
  }
  return grouped
}
