import { fitGraphCameraToPoints } from '@baishou/shared'
import type { GraphCanvasEdge, GraphCanvasNode } from './graph-force-canvas.types'

export const GRAPH_CANVAS_DRAG_THRESHOLD_PX = 5
export const GRAPH_CANVAS_LOCATE_TARGET_K = 1.85
export const GRAPH_CANVAS_CAMERA_FOLLOW_LERP = 0.2
export const GRAPH_CANVAS_CAMERA_CENTER_MS = 480
export const GRAPH_CANVAS_CAMERA_LOCATE_MS = 620

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function isGraphCanvasRejected(status?: string): boolean {
  return status === 'rejected'
}

export function isGraphCanvasPending(status?: string): boolean {
  return status === 'pending'
}

export function graphCanvasNodeRadius(mentionCount: number | undefined, nodeScale: number): number {
  return (6 + Math.min(10, (mentionCount ?? 1) * 1.2)) * nodeScale
}

export function graphCanvasHitRadius(mentionCount: number | undefined, nodeScale: number): number {
  return (8 + Math.min(10, (mentionCount ?? 1) * 1.2)) * nodeScale
}

export function graphCanvasWorldPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  transform: { x: number; y: number; k: number }
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - transform.x) / transform.k,
    y: (clientY - rect.top - transform.y) / transform.k
  }
}

export function graphForceCameraTargetForPoints(
  pts: Array<{ x: number; y: number }>,
  w: number,
  h: number,
  k: number
): { x: number; y: number; k: number } | null {
  if (w <= 0 || h <= 0 || pts.length === 0) return null
  if (pts.length === 1) {
    return {
      x: w / 2 - pts[0]!.x * k,
      y: h / 2 - pts[0]!.y * k,
      k
    }
  }
  return fitGraphCameraToPoints(pts, w, h, { padding: 80, maxK: k, minK: 0.45 })
}

export function filterGraphCanvasTopology(
  nodes: GraphCanvasNode[],
  edges: GraphCanvasEdge[]
): {
  nodes: GraphCanvasNode[]
  links: Array<{
    id: string
    edgeType: string
    reviewStatus?: string
    source: string
    target: string
  }>
} {
  const nextNodes = nodes.filter((n) => !isGraphCanvasRejected(n.reviewStatus))
  const nextIdSet = new Set(nextNodes.map((n) => n.id))
  const nextLinks = edges
    .filter(
      (e) =>
        !isGraphCanvasRejected(e.reviewStatus) && nextIdSet.has(e.fromId) && nextIdSet.has(e.toId)
    )
    .map((e) => ({
      id: e.id,
      edgeType: e.edgeType,
      reviewStatus: e.reviewStatus,
      source: e.fromId,
      target: e.toId
    }))
  return { nodes: nextNodes, links: nextLinks }
}

export function graphCanvasTopologyFingerprint(nodeIds: string[], linkIds: string[]): string {
  return `${[...nodeIds].sort().join(',')}|${[...linkIds].sort().join(',')}`
}

export function buildGraphCanvasDegreeMap(
  links: Array<{ source: string | { id?: string }; target: string | { id?: string } }>
): Map<string, number> {
  const nextDegree = new Map<string, number>()
  for (const l of links) {
    const sid = String(typeof l.source === 'string' ? l.source : l.source.id)
    const tid = String(typeof l.target === 'string' ? l.target : l.target.id)
    nextDegree.set(sid, (nextDegree.get(sid) ?? 0) + 1)
    nextDegree.set(tid, (nextDegree.get(tid) ?? 0) + 1)
  }
  return nextDegree
}

export function shouldShowGraphCanvasLabel(opts: {
  textAlpha: number
  dim: boolean
  nodeId: string
  selectedId?: string | null
  multiSelected: boolean
  highlighted: boolean
  focusing: boolean
  inFocus: boolean
  isHub: boolean
}): boolean {
  return (
    opts.textAlpha > 0.01 &&
    !opts.dim &&
    (opts.nodeId === opts.selectedId ||
      opts.multiSelected ||
      opts.highlighted ||
      (opts.focusing && opts.inFocus) ||
      opts.isHub)
  )
}

export function findGraphCanvasNodeAtPoint<
  T extends { id?: string; x?: number | null; y?: number | null; mentionCount?: number }
>(nodes: T[], x: number, y: number, nodeScale: number): T | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]!
    if (n.x == null || n.y == null) continue
    const r = graphCanvasHitRadius(n.mentionCount, nodeScale)
    const dx = n.x - x
    const dy = n.y - y
    if (dx * dx + dy * dy <= r * r) return n
  }
  return null
}

export function seedGraphForceNodePosition(opts: {
  prev?: { x?: number | null; y?: number | null; vx?: number | null; vy?: number | null }
  locating: boolean
  isSelected: boolean
  cx: number
  cy: number
  nodeCount: number
  random?: () => number
}): { x: number; y: number; vx?: number; vy?: number } {
  const random = opts.random ?? Math.random
  let x = opts.prev?.x ?? undefined
  let y = opts.prev?.y ?? undefined
  if (x == null || y == null || (opts.locating && opts.isSelected)) {
    if (opts.isSelected) {
      x = opts.cx
      y = opts.cy
    } else {
      const spread = Math.min(280, 80 + Math.sqrt(opts.nodeCount) * 12)
      const angle = random() * Math.PI * 2
      const rad = Math.sqrt(random()) * spread
      x = opts.cx + Math.cos(angle) * rad
      y = opts.cy + Math.sin(angle) * rad
    }
  }
  return {
    x,
    y,
    vx: opts.locating ? 0 : (opts.prev?.vx ?? undefined),
    vy: opts.locating ? 0 : (opts.prev?.vy ?? undefined)
  }
}

export function graphCanvasApplyZoom(
  transform: { x: number; y: number; k: number },
  mx: number,
  my: number,
  deltaY: number
): { x: number; y: number; k: number } | null {
  const factor = deltaY > 0 ? 0.9 : 1.1
  const k1 = Math.min(3, Math.max(0.3, transform.k * factor))
  if (k1 === transform.k) return null
  return {
    x: mx - ((mx - transform.x) * k1) / transform.k,
    y: my - ((my - transform.y) * k1) / transform.k,
    k: k1
  }
}

export function graphCanvasCameraFitIds(
  locateIds: string[] | undefined,
  selectedId: string | null | undefined
): string[] {
  if (locateIds && locateIds.length > 0) return locateIds
  return selectedId ? [selectedId] : []
}
