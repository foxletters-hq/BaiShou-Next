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

export interface ToolKnowledgeGraphNode {
  id: string
  name: string
  nodeType: string
  summary?: string
}

export interface ToolKnowledgeGraphEdge {
  id: string
  fromId: string
  toId: string
  edgeType: string
  sourceExcerpt?: string
}

export interface ToolKnowledgeGraphSearchResult {
  nodes: ToolKnowledgeGraphNode[]
  edges: ToolKnowledgeGraphEdge[]
  paths?: Array<{ nodeNames: string[]; excerpts: string[] }>
}

export interface ToolKnowledgeGraphReader {
  search(opts: {
    query: string
    notebookId: string
    limit?: number
  }): Promise<ToolKnowledgeGraphSearchResult>
}
