/** Facade for AI tools — no @baishou/core import */

export interface ToolKnowledgeSearchHit {
  chunkId: string
  sourceId: string
  notebookId: string
  notebookName?: string
  chunkIndex: number
  chunkText: string
  score: number
  title?: string
  page?: number
  offset?: number
  len?: number
}

export interface ToolKnowledgeReader {
  search(opts: {
    query: string
    notebookIds: string[]
    limit?: number
    limitPerNotebook?: number
  }): Promise<ToolKnowledgeSearchHit[]>
}

export interface ToolKnowledgeGraphNode {
  id: string
  name: string
  nodeType: string
  summary?: string
  notebookId?: string
  notebookName?: string
}

export interface ToolKnowledgeGraphEdge {
  id: string
  fromId: string
  toId: string
  edgeType: string
  sourceExcerpt?: string
  notebookId?: string
}

export interface ToolKnowledgeGraphSearchResult {
  notebookId?: string
  notebookName?: string
  nodes: ToolKnowledgeGraphNode[]
  edges: ToolKnowledgeGraphEdge[]
  paths?: Array<{ nodeNames: string[]; excerpts: string[] }>
}

export interface ToolKnowledgeGraphReader {
  search(opts: {
    query: string
    notebookIds: string[]
    limit?: number
  }): Promise<ToolKnowledgeGraphSearchResult[]>
}
