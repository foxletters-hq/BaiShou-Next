import { forceManyBody, type ForceManyBody } from 'd3-force'
import { graphForcePairChargeScale } from '@baishou/shared'
import type { GraphForceSimNode } from './graph-force-canvas.types'

export type GraphAwareChargeForce = ((alpha: number) => void) & {
  initialize: (nodes: GraphForceSimNode[], random?: () => number) => void
  configure: (chargeStrength: number, degreeById: Map<string, number>) => void
}

/**
 * 连通核仍用 many-body。独立节点先还原核给它的速度，再按配对比例自己推开，
 * 避免被核推出隔离带后挤成几坨。
 */
export function createGraphAwareChargeForce(): GraphAwareChargeForce {
  const manyBody = forceManyBody<GraphForceSimNode>() as ForceManyBody<GraphForceSimNode> & {
    initialize?: (nodes: GraphForceSimNode[], random?: () => number) => void
  }
  let nodes: GraphForceSimNode[] = []
  let degreeById = new Map<string, number>()
  let chargeStrength = 0

  const isIso = (id: string) => (degreeById.get(id) ?? 0) <= 0

  function applyPair(a: GraphForceSimNode, b: GraphForceSimNode, strength: number, alpha: number) {
    const dx = (a.x ?? 0) - (b.x ?? 0)
    const dy = (a.y ?? 0) - (b.y ?? 0)
    const dist2 = dx * dx + dy * dy || 1
    const k = (Math.abs(strength) * alpha) / dist2
    a.vx = (a.vx ?? 0) + dx * k
    a.vy = (a.vy ?? 0) + dy * k
    b.vx = (b.vx ?? 0) - dx * k
    b.vy = (b.vy ?? 0) - dy * k
  }

  function force(alpha: number) {
    const isolated: GraphForceSimNode[] = []
    const saved: Array<{ node: GraphForceSimNode; vx: number; vy: number }> = []
    for (const node of nodes) {
      if (!isIso(node.id)) continue
      isolated.push(node)
      saved.push({ node, vx: node.vx ?? 0, vy: node.vy ?? 0 })
    }
    manyBody.strength((d) => (isIso(d.id) ? 0 : chargeStrength))
    manyBody(alpha)
    for (const item of saved) {
      item.node.vx = item.vx
      item.node.vy = item.vy
    }
    for (let i = 0; i < isolated.length; i++) {
      const a = isolated[i]!
      for (let j = i + 1; j < isolated.length; j++) {
        const b = isolated[j]!
        applyPair(a, b, chargeStrength * graphForcePairChargeScale(0, 0), alpha)
      }
    }
    const mixed = chargeStrength * graphForcePairChargeScale(0, 1)
    if (mixed !== 0) {
      for (const a of isolated) {
        for (const b of nodes) {
          if (isIso(b.id)) continue
          applyPair(a, b, mixed, alpha)
        }
      }
    }
  }

  force.initialize = (next: GraphForceSimNode[], random?: () => number) => {
    nodes = next
    manyBody.initialize?.(next, random ?? Math.random)
  }

  force.configure = (nextCharge: number, nextDegree: Map<string, number>) => {
    chargeStrength = nextCharge
    degreeById = nextDegree
  }

  return force
}
