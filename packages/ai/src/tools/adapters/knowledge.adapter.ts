import type {
  ToolKnowledgeGraphReader,
  ToolKnowledgeGraphSearchResult,
  ToolKnowledgeReader,
  ToolKnowledgeSearchHit
} from '@baishou/shared'
import { parseMountedNotebookIds } from '@baishou/shared'

export type KnowledgeSearchFn = (opts: {
  query: string
  notebookIds: string[]
  limit?: number
  limitPerNotebook?: number
}) => Promise<ToolKnowledgeSearchHit[]>

export type KnowledgeGraphSearchFn = (opts: {
  query: string
  notebookIds: string[]
  limit?: number
}) => Promise<ToolKnowledgeGraphSearchResult[]>

/**
 * Host-injected knowledge adapter for knowledge_search tool.
 */
export class KnowledgeReaderAdapter implements ToolKnowledgeReader {
  constructor(private readonly searchFn: KnowledgeSearchFn) {}

  async search(opts: {
    query: string
    notebookIds: string[]
    limit?: number
    limitPerNotebook?: number
  }): Promise<ToolKnowledgeSearchHit[]> {
    const notebookIds = parseMountedNotebookIds(opts.notebookIds)
    if (notebookIds.length === 0) return []
    return this.searchFn({
      query: opts.query,
      notebookIds,
      limit: opts.limit,
      limitPerNotebook: opts.limitPerNotebook
    })
  }
}

/** Host-injected adapter for knowledge_graph_search */
export class KnowledgeGraphReaderAdapter implements ToolKnowledgeGraphReader {
  constructor(private readonly searchFn: KnowledgeGraphSearchFn) {}

  async search(opts: {
    query: string
    notebookIds: string[]
    limit?: number
  }): Promise<ToolKnowledgeGraphSearchResult[]> {
    const notebookIds = parseMountedNotebookIds(opts.notebookIds)
    if (notebookIds.length === 0) return []
    return this.searchFn({
      query: opts.query,
      notebookIds,
      limit: opts.limit
    })
  }
}
