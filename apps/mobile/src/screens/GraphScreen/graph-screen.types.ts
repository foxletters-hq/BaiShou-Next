import type { GraphSameNameExisting } from '@baishou/shared'
import type { GraphExtractQueueSnapshot } from '@/src/services/mobile-graph-extract-queue.service'

export type GraphScreenTab = 'graph' | 'search' | 'reextract' | 'pending' | 'similar'

export type GraphCostEstimate = {
  entryCount: number
  estimatedTokens: number
  estimatedMinutesLow: number
  estimatedMinutesHigh: number
}

export type GraphSourcePreview = {
  date: string | null
  content: string
  loading: boolean
}

export type GraphPendingItem =
  | { kind: 'node'; id: string; data: any }
  | { kind: 'edge'; id: string; data: any }

export type GraphScreenNode = {
  id: string
  name?: string
  nodeType?: string
  reviewStatus?: string
  discriminator?: string
  aliases?: unknown
  summary?: string
  origin?: string
  propsJson?: string | null
  mentionCount?: number
}

export type GraphScreenEdge = {
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
  nodes: GraphScreenNode[]
  edges: GraphScreenEdge[]
}

export type GraphEditNameConflict = GraphSameNameExisting

export type GraphNameCandidate = {
  nodeId: string
  name: string
  discriminator: string
  label: string
}

export type GraphScreenTranslateFn = (
  key: string,
  defaultValue?: string,
  options?: Record<string, unknown>
) => string

export type GraphScreenSettingsSection = {
  organize: boolean
  profile: boolean
  data: boolean
  canvas: boolean
  appearance: boolean
  forces: boolean
}

export type { GraphExtractQueueSnapshot }
