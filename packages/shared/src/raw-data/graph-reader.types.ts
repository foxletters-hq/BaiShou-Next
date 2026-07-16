/** Facade for AI tools — no @baishou/core import */

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
}

export interface ToolGraphReader {
  recallRelations(opts: {
    entity: string
    mode: 'network' | 'timeline'
  }): Promise<ToolGraphRagResult>
}
