import type { GraphSameNameExisting } from '@baishou/shared'

export type GraphSideTab = 'reextract' | 'pending' | 'similar' | 'detail'
export type GraphSideMode = 'organize' | 'canvas' | 'content'

export type GraphNameCandidate = {
  nodeId: string
  name: string
  discriminator: string
  label: string
}

export type GraphCostEstimate = {
  entryCount: number
  estimatedTokens: number
  estimatedMinutesLow: number
  estimatedMinutesHigh: number
}

export type GraphSourcePreview = {
  date: string | null
  content: string
  excerpt?: string | null
  basePath?: string
  loading: boolean
}

export type GraphPageNode = {
  id: string
  name?: string
  nodeType?: string
  reviewStatus?: string
  discriminator?: string
  aliases?: unknown
  summary?: string
  origin?: string
  propsJson?: string | null
}

export type GraphPageEdge = {
  id: string
  fromId: string
  toId: string
  edgeType?: string
  reviewStatus?: string
  sourceRef?: string | null
  sourceExcerpt?: string | null
  confidence?: number
}

export type GraphLocalView = {
  nodes: GraphPageNode[]
  edges: GraphPageEdge[]
}

export type GraphEditNameConflict = GraphSameNameExisting

export type GraphPageTranslateFn = (
  key: string,
  defaultValue?: string,
  options?: Record<string, unknown>
) => string

export type GraphPageProps = {
  embedded?: boolean
  highlightStartOrganize?: boolean
  autoStartOrganize?: boolean
  onAutoStartOrganizeConsumed?: () => void
  /** 与记忆中心共用的整理入口；未传时空态仍走本页抽图。 */
  onUnifiedOrganize?: () => void
}
