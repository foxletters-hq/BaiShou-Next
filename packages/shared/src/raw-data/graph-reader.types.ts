/** Facade for AI tools — no @baishou/core import */

export interface ToolGraphPath {
  nodeIds: string[]
  nodeNames: string[]
  edges: Array<{
    id: string
    fromId: string
    toId: string
    edgeType: string
    sourceRef?: string | null
    sourceExcerpt?: string
  }>
}

export interface ToolGraphRagResult {
  anchors: Array<{
    id: string
    name: string
    nodeType: string
    summary?: string
  }>
  subgraph: Array<{
    id: string
    fromId: string
    toId: string
    edgeType: string
    sourceRef?: string | null
    sourceExcerpt?: string
    validFrom?: number | null
  }>
  timeline?: Array<{
    id: string
    fromId: string
    toId: string
    edgeType: string
    sourceRef?: string | null
    sourceExcerpt?: string
    validFrom?: number | null
  }>
  nodes: Array<{
    id: string
    name: string
    nodeType: string
    summary?: string
  }>
  /** Shortest relation paths with diary excerpts (network mode). */
  paths?: ToolGraphPath[]
}

export interface ToolGraphReader {
  recallRelations(opts: {
    entity: string
    mode: 'network' | 'timeline'
  }): Promise<ToolGraphRagResult>
}
