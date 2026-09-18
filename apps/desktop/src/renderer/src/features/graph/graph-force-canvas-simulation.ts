import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force'
import type {
  GraphCanvasEdge,
  GraphCanvasNode,
  GraphForceSimLink,
  GraphForceSimNode
} from './graph-force-canvas.types'
import {
  buildGraphCanvasDegreeMap,
  filterGraphCanvasTopology,
  graphCanvasTopologyFingerprint,
  seedGraphForceNodePosition
} from './graph-force-canvas.util'
import type { GraphForceCanvasEngineRefs } from './graph-force-canvas-engine.types'

export function patchGraphForceSimulationMeta(
  refs: GraphForceCanvasEngineRefs,
  nodes: GraphCanvasNode[],
  links: Array<{ id: string; edgeType: string; reviewStatus?: string }>
): void {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  for (const n of refs.nodesRef.current) {
    const fresh = byId.get(n.id)
    if (!fresh) continue
    n.name = fresh.name
    n.nodeType = fresh.nodeType
    n.mentionCount = fresh.mentionCount
    n.reviewStatus = fresh.reviewStatus
  }
  const linkMeta = new Map(links.map((l) => [l.id, l]))
  for (const l of refs.linksRef.current) {
    const fresh = linkMeta.get(l.id)
    if (!fresh) continue
    l.edgeType = fresh.edgeType
    l.reviewStatus = fresh.reviewStatus
  }
}

export function rebuildGraphForceSimulation(
  refs: GraphForceCanvasEngineRefs,
  canvas: HTMLCanvasElement,
  nodes: GraphCanvasNode[],
  edges: GraphCanvasEdge[]
): boolean {
  const topology = filterGraphCanvasTopology(nodes, edges)
  const fp = graphCanvasTopologyFingerprint(
    topology.nodes.map((n) => n.id),
    topology.links.map((l) => l.id)
  )

  if (fp === refs.graphFpRef.current && refs.simRef.current) {
    patchGraphForceSimulationMeta(refs, topology.nodes, topology.links)
    return false
  }

  refs.degreeByIdRef.current = buildGraphCanvasDegreeMap(topology.links)
  refs.graphFpRef.current = fp
  const prevById = new Map(refs.nodesRef.current.map((n) => [n.id, n]))
  const cx = Math.max(1, canvas.clientWidth) / 2
  const cy = Math.max(1, canvas.clientHeight) / 2
  const locating = refs.followUntilRef.current > performance.now() || refs.pendingZoomRef.current
  const selected = refs.selectedRef.current

  const simNodes: GraphForceSimNode[] = topology.nodes.map((n) => {
    const prev = prevById.get(n.id)
    const pos = seedGraphForceNodePosition({
      prev,
      locating,
      isSelected: n.id === selected,
      cx,
      cy,
      nodeCount: topology.nodes.length
    })
    return {
      ...n,
      x: pos.x,
      y: pos.y,
      vx: pos.vx,
      vy: pos.vy
    }
  })
  const simLinks: GraphForceSimLink[] = topology.links.map((e) => ({ ...e }))

  refs.nodesRef.current = simNodes
  refs.linksRef.current = simLinks

  const forces = refs.forceRef.current
  refs.simRef.current?.stop()
  const sim = forceSimulation(simNodes)
    .force(
      'link',
      forceLink<GraphForceSimNode, GraphForceSimLink>(simLinks)
        .id((d) => d.id)
        .distance(forces.linkDistance)
        .strength(forces.linkStrength)
    )
    .force('charge', forceManyBody().strength(forces.chargeStrength))
    .force('x', forceX(cx).strength(forces.centerStrength))
    .force('y', forceY(cy).strength(forces.centerStrength))
    .force(
      'collide',
      forceCollide<GraphForceSimNode>().radius(
        (d) =>
          (10 + Math.min(12, (d.mentionCount ?? 1) * 1.5)) * refs.appearanceRef.current.nodeSize
      )
    )
    .on('tick', () => refs.drawRef.current())

  refs.simRef.current = sim
  return true
}
