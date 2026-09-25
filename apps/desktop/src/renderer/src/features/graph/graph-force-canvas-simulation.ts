import {
  forceCollide,
  forceLink,
  forceSimulation,
  forceX,
  forceY,
  type ForceLink,
  type ForceX,
  type ForceY,
  type Simulation
} from 'd3-force'
import {
  GRAPH_FORCE_VELOCITY_DECAY,
  countIsolatedGraphForceNodes,
  graphForceCenterNeedsUpdate,
  graphForceNodeCenterStrength,
  type GraphForceSettings
} from '@baishou/shared'
import {
  createGraphAwareChargeForce,
  type GraphAwareChargeForce
} from './graph-force-canvas-charge'
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

const lastForceCenter = new WeakMap<
  Simulation<GraphForceSimNode, GraphForceSimLink>,
  { x: number; y: number }
>()

export function applyGraphForceCenter(
  sim: Simulation<GraphForceSimNode, GraphForceSimLink>,
  x: number,
  y: number
): void {
  const next = { x, y }
  if (!graphForceCenterNeedsUpdate(lastForceCenter.get(sim), next)) return
  lastForceCenter.set(sim, next)
  const fx = sim.force('x') as ForceX<GraphForceSimNode> | undefined
  const fy = sim.force('y') as ForceY<GraphForceSimNode> | undefined
  fx?.x(x)
  fy?.y(y)
}

export function applyGraphForceStrengths(
  sim: Simulation<GraphForceSimNode, GraphForceSimLink>,
  forces: GraphForceSettings,
  degreeById: Map<string, number>
): void {
  const link = sim.force('link') as ForceLink<GraphForceSimNode, GraphForceSimLink> | undefined
  const charge = sim.force('charge') as GraphAwareChargeForce | undefined
  const fx = sim.force('x') as ForceX<GraphForceSimNode> | undefined
  const fy = sim.force('y') as ForceY<GraphForceSimNode> | undefined
  link?.distance(forces.linkDistance).strength(forces.linkStrength)
  charge?.configure(forces.chargeStrength, degreeById)
  fx?.strength((d) =>
    graphForceNodeCenterStrength(forces.centerStrength, degreeById.get(d.id) ?? 0)
  )
  fy?.strength((d) =>
    graphForceNodeCenterStrength(forces.centerStrength, degreeById.get(d.id) ?? 0)
  )
}

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
  const isolatedCount = countIsolatedGraphForceNodes(
    topology.nodes.map((n) => n.id),
    refs.degreeByIdRef.current
  )

  const simNodes: GraphForceSimNode[] = topology.nodes.map((n) => {
    const prev = prevById.get(n.id)
    const pos = seedGraphForceNodePosition({
      prev,
      locating,
      isSelected: n.id === selected,
      isolated: (refs.degreeByIdRef.current.get(n.id) ?? 0) <= 0,
      isolatedCount,
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
    .velocityDecay(GRAPH_FORCE_VELOCITY_DECAY)
    .force(
      'link',
      forceLink<GraphForceSimNode, GraphForceSimLink>(simLinks)
        .id((d) => d.id)
        .distance(forces.linkDistance)
        .strength(forces.linkStrength)
    )
    .force('charge', createGraphAwareChargeForce())
    .force('x', forceX(cx))
    .force('y', forceY(cy))
    .force(
      'collide',
      forceCollide<GraphForceSimNode>().radius(
        (d) =>
          (10 + Math.min(12, (d.mentionCount ?? 1) * 1.5)) * refs.appearanceRef.current.nodeSize
      )
    )
    .on('tick', () => refs.drawRef.current())

  applyGraphForceStrengths(sim, forces, refs.degreeByIdRef.current)
  refs.simRef.current = sim
  return true
}
