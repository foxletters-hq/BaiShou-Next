export type KnowledgeSourceRow = {
  id: string
  title: string
  status: string
  errorMessage?: string | null
}

export type KnowledgeGraphNodeRow = {
  id: string
  name: string
  nodeType: string
}

export type KnowledgeGraphEdgeRow = {
  id: string
  fromId: string
  toId: string
  edgeType: string
}
