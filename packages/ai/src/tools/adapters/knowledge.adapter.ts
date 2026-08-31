import type {
  ToolKnowledgeGraphReader,
  ToolKnowledgeGraphSearchResult,
  ToolKnowledgeReader,
  ToolKnowledgeSearchHit
} from '@baishou/shared'

export type KnowledgeSearchFn = (opts: {
  query: string
  notebookId: string
  limit?: number
}) => Promise<ToolKnowledgeSearchHit[]>

export type KnowledgeGraphSearchFn = (opts: {
  query: string
  notebookId: string
  limit?: number
}) => Promise<ToolKnowledgeGraphSearchResult>

/**
 * Host-injected knowledge adapter for knowledge_search tool.
 */
export class KnowledgeReaderAdapter implements ToolKnowledgeReader {
  constructor(private readonly searchFn: KnowledgeSearchFn) {}

  async search(opts: {
    query: string
    notebookId: string
    limit?: number
  }): Promise<ToolKnowledgeSearchHit[]> {
    return this.searchFn(opts)
  }
}

/** Host-injected adapter for knowledge_graph_search */
export class KnowledgeGraphReaderAdapter implements ToolKnowledgeGraphReader {
  constructor(private readonly searchFn: KnowledgeGraphSearchFn) {}

  async search(opts: {
    query: string
    notebookId: string
    limit?: number
  }): Promise<ToolKnowledgeGraphSearchResult> {
    return this.searchFn(opts)
  }
}
