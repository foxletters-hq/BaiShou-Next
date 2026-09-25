export type KnowledgeSourceRow = {
  id: string
  title: string
  status: string
  errorMessage?: string | null
  extractEngine?: string | null
}

export type KnowledgeGraphNodeRow = {
  id: string
  name: string
  nodeType: string
  reviewStatus?: string
  summary?: string
  propsJson?: string
}

export type KnowledgeGraphEdgeRow = {
  id: string
  fromId: string
  toId: string
  edgeType: string
  reviewStatus?: string
  sourceExcerpt?: string
}

export type KnowledgeOcrProgressState = {
  page: number
  total: number
  phase?: 'ocr' | 'vision' | 'render' | 'embed'
}
