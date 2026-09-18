export interface GraphForceNode {
  id: string
  name: string
  nodeType: string
  discriminator?: string
  mentionCount?: number
  reviewStatus?: string
}

export interface GraphForceEdge {
  id: string
  fromId: string
  toId: string
  edgeType: string
  reviewStatus?: string
}
