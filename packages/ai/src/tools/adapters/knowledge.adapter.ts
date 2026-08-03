import type { ToolKnowledgeReader, ToolKnowledgeSearchHit } from '@baishou/shared'

export type KnowledgeSearchFn = (opts: {
  query: string
  notebookId: string
  limit?: number
}) => Promise<ToolKnowledgeSearchHit[]>

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
