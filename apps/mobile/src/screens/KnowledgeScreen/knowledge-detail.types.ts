export type KnowledgeSourceRow = {
  id: string
  title: string
  status: string
  errorMessage?: string | null
  extractEngine?: string | null
  sourceKind?: string
  originUrl?: string | null
  relativePath?: string | null
  pageCount?: number | null
  textPageCount?: number | null
}

export type KnowledgeGraphNodeRow = {
  id: string
  name: string
  nodeType: string
  reviewStatus?: string
  summary?: string
  propsJson?: string
  mentionCount?: number
}

export type KnowledgeGraphEdgeRow = {
  id: string
  fromId: string
  toId: string
  edgeType: string
  reviewStatus?: string
  sourceExcerpt?: string
  sourceRef?: string | null
}

export type KnowledgeOcrProgressState = {
  page: number
  total: number
  phase?: 'ocr' | 'vision' | 'render' | 'embed' | 'parse' | 'recognize'
}
