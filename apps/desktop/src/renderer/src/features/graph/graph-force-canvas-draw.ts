import {
  GRAPH_CANVAS_THEME,
  GRAPH_NODE_TYPE_COLOR_FALLBACK,
  GRAPH_NODE_TYPE_COLORS,
  isGraphHubLabelVisible,
  type GraphAppearanceSettings
} from '@baishou/shared'
import type { GraphForceSimLink, GraphForceSimNode } from './graph-force-canvas.types'
import {
  graphCanvasNodeRadius,
  isGraphCanvasPending,
  shouldShowGraphCanvasLabel
} from './graph-force-canvas.util'

const TYPE_COLORS = GRAPH_NODE_TYPE_COLORS
const TYPE_COLOR_FALLBACK = GRAPH_NODE_TYPE_COLOR_FALLBACK
const EDGE_HIGHLIGHT = GRAPH_CANVAS_THEME.light.edgeHighlight

export function drawGraphArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const t = 0.82
  const ax = x1 + (x2 - x1) * t
  const ay = y1 + (y2 - y1) * t
  ctx.beginPath()
  ctx.moveTo(ax, ay)
  ctx.lineTo(ax - size * Math.cos(angle - 0.4), ay - size * Math.sin(angle - 0.4))
  ctx.lineTo(ax - size * Math.cos(angle + 0.4), ay - size * Math.sin(angle + 0.4))
  ctx.closePath()
  ctx.fill()
}

export function drawGraphForceFrame(opts: {
  ctx: CanvasRenderingContext2D
  width: number
  height: number
  transform: { x: number; y: number; k: number }
  nodes: GraphForceSimNode[]
  links: GraphForceSimLink[]
  appearance: GraphAppearanceSettings
  highlightIds?: Set<string>
  highlightEdgeIds?: Set<string>
  focusIds?: Set<string>
  selectedId?: string | null
  selectedIds?: Set<string>
  degreeById: Map<string, number>
}): void {
  const { ctx, width: w, height: h, transform, nodes, links, appearance } = opts
  ctx.clearRect(0, 0, w, h)
  const { x: tx, y: ty, k } = transform
  const highlights = opts.highlightIds
  const selected = opts.selectedId
  const focus = opts.focusIds
  const nodeScale = appearance.nodeSize
  const lineScale = appearance.lineThickness
  const textAlpha = appearance.textOpacity
  const focusing = Boolean(selected && focus && focus.size > 0)

  ctx.save()
  ctx.translate(tx, ty)
  ctx.scale(k, k)

  ctx.lineWidth = (1 * lineScale) / k
  for (const link of links) {
    const s = link.source as GraphForceSimNode
    const t = link.target as GraphForceSimNode
    if (s.x == null || t.x == null || s.y == null || t.y == null) continue
    const pending = isGraphCanvasPending(link.reviewStatus)
    const edgeHighlighted = opts.highlightEdgeIds?.has(link.id) === true
    const incident =
      !focusing ||
      s.id === selected ||
      t.id === selected ||
      edgeHighlighted ||
      (focus?.has(s.id) === true && focus?.has(t.id) === true)
    if (focusing && !incident) continue
    const stroke = edgeHighlighted
      ? EDGE_HIGHLIGHT
      : pending
        ? focusing
          ? 'rgba(100,116,139,0.28)'
          : 'rgba(100,116,139,0.22)'
        : focusing
          ? 'rgba(100,116,139,0.55)'
          : 'rgba(100,116,139,0.45)'
    ctx.globalAlpha = 1
    ctx.strokeStyle = stroke
    ctx.fillStyle = stroke
    ctx.lineWidth = ((edgeHighlighted ? 2.6 : 1) * lineScale) / k
    ctx.setLineDash(pending ? [4 / k, 4 / k] : [])
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.lineTo(t.x, t.y)
    ctx.stroke()
    if (appearance.showArrows && !pending) {
      drawGraphArrowHead(ctx, s.x, s.y, t.x, t.y, (6 * lineScale) / k)
    }
  }
  ctx.setLineDash([])
  ctx.lineWidth = (1 * lineScale) / k

  const degreeById = opts.degreeById

  for (const n of nodes) {
    if (n.x == null || n.y == null) continue
    const r = graphCanvasNodeRadius(n.mentionCount, nodeScale)
    const multiSelected = opts.selectedIds?.has(n.id) === true
    const highlighted = highlights?.has(n.id) || n.id === selected || multiSelected
    const pending = isGraphCanvasPending(n.reviewStatus)
    const inFocus = !focusing || focus?.has(n.id) === true
    const dim = focusing && !inFocus
    const isHub = isGraphHubLabelVisible({
      degree: degreeById.get(n.id) ?? 0,
      mentionCount: n.mentionCount ?? 0,
      hubLabelMinDegree: appearance.hubLabelMinDegree,
      hubLabelMinMentions: appearance.hubLabelMinMentions,
      showIsolatedLabels: appearance.showIsolatedNodes
    })
    ctx.globalAlpha = dim ? 0.1 : pending && !highlighted ? 0.45 : 1
    ctx.beginPath()
    ctx.fillStyle = TYPE_COLORS[n.nodeType] || TYPE_COLOR_FALLBACK
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
    ctx.fill()
    if (multiSelected) {
      ctx.strokeStyle = '#2563eb'
      ctx.lineWidth = (2.8 * lineScale) / k
      ctx.stroke()
    } else if (highlighted) {
      ctx.setLineDash(pending ? [3 / k, 3 / k] : [])
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = (2.5 * lineScale) / k
      ctx.stroke()
      ctx.setLineDash([])
    } else if (pending && inFocus) {
      ctx.setLineDash([3 / k, 3 / k])
      ctx.strokeStyle = 'rgba(15,23,42,0.55)'
      ctx.lineWidth = (1.5 * lineScale) / k
      ctx.stroke()
      ctx.setLineDash([])
    }
    const showLabel = shouldShowGraphCanvasLabel({
      textAlpha,
      dim,
      nodeId: n.id,
      selectedId: selected,
      multiSelected,
      highlighted: highlights?.has(n.id) === true,
      focusing,
      inFocus,
      isHub
    })
    if (showLabel) {
      ctx.globalAlpha = (pending ? 0.45 : 1) * textAlpha
      ctx.fillStyle = '#0f172a'
      ctx.font = `${12 / k}px sans-serif`
      ctx.fillText(n.name.slice(0, 16), n.x + r + 2, n.y + 4)
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()
}
