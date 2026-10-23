import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force'

export interface GraphCanvasNode {
  id: string
  name: string
  nodeType: string
  mentionCount?: number
  reviewStatus?: string
}

export interface GraphCanvasEdge {
  id: string
  fromId: string
  toId: string
  edgeType: string
  reviewStatus?: string
}

export type GraphForceSimNode = SimulationNodeDatum & GraphCanvasNode
export type GraphForceSimLink = SimulationLinkDatum<GraphForceSimNode> & {
  id: string
  edgeType: string
  reviewStatus?: string
}
