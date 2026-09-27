import { forceManyBody, type ForceManyBody } from 'd3-force'
import { applyGraphForceIsolatedPairCharge, graphForceChargeDistanceMax } from '@baishou/shared'
import type { GraphForceSimNode } from './graph-force-canvas.types'

export type GraphAwareChargeForce = ((alpha: number) => void) & {
  initialize: (nodes: GraphForceSimNode[], random?: () => number) => void
  configure: (
    chargeStrength: number,
    degreeById: Map<string, number>,
    linkDistance?: number
  ) => void
}

/**
 * 连通核走 many-body。独立节点不进四叉树，只跟网格邻居互斥，
 * 也不再跟核做 O(n²) 混合排斥。
 */
export function createGraphAwareChargeForce(): GraphAwareChargeForce {
  const manyBody = forceManyBody<GraphForceSimNode>() as ForceManyBody<GraphForceSimNode> & {
    initialize?: (nodes: GraphForceSimNode[], random?: () => number) => void
  }
  let nodes: GraphForceSimNode[] = []
  let degreeById = new Map<string, number>()
  let chargeStrength = 0
  let linkDistance = 70

  function force(alpha: number) {
    const connected: GraphForceSimNode[] = []
    const isolated: GraphForceSimNode[] = []
    for (const node of nodes) {
      if ((degreeById.get(node.id) ?? 0) <= 0) isolated.push(node)
      else connected.push(node)
    }
    if (connected.length > 0) {
      manyBody.strength(chargeStrength)
      manyBody.distanceMax(graphForceChargeDistanceMax(linkDistance))
      manyBody.initialize?.(connected, Math.random)
      manyBody(alpha)
    }
    applyGraphForceIsolatedPairCharge(isolated, chargeStrength, alpha)
  }

  force.initialize = (next: GraphForceSimNode[]) => {
    nodes = next
  }

  force.configure = (
    nextCharge: number,
    nextDegree: Map<string, number>,
    nextLinkDistance?: number
  ) => {
    chargeStrength = nextCharge
    degreeById = nextDegree
    if (nextLinkDistance != null) linkDistance = nextLinkDistance
  }

  return force
}
