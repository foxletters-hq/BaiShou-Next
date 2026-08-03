/** Facade for AI tools — no @baishou/core import */

export interface ToolKnowledgeSearchHit {
  chunkId: string
  sourceId: string
  notebookId: string
  chunkIndex: number
  chunkText: string
  score: number
  title?: string
  offset?: number
  len?: number
}

export interface ToolKnowledgeReader {
  search(opts: {
    query: string
    notebookId: string
    limit?: number
  }): Promise<ToolKnowledgeSearchHit[]>
}
