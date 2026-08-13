import React, { useEffect, useRef } from 'react'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type ForceLink,
  type ForceManyBody,
  type ForceX,
  type ForceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum
} from 'd3-force'
import {
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_FORCE_DEFAULTS,
  type GraphAppearanceSettings,
  type GraphForceSettings
} from '@baishou/shared'

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

type SimNode = SimulationNodeDatum & GraphCanvasNode
type SimLink = SimulationLinkDatum<SimNode> & {
  id: string
  edgeType: string
  reviewStatus?: string
}

const TYPE_COLORS: Record<string, string> = {
  person: '#3b82f6',
  place: '#22c55e',
  organization: '#a855f7',
  event: '#f59e0b',
  emotion: '#ec4899',
  topic: '#64748b',
  work: '#0ea5e9',
  activity: '#14b8a6',
  product: '#8b5cf6',
  food: '#f97316',
  entry: '#94a3b8'
}

const DRAG_THRESHOLD_PX = 5
const LOCATE_TARGET_K = 1.85
/** Soft follow while layout settles after centering. */
const CAMERA_FOLLOW_LERP = 0.2
const CAMERA_CENTER_MS = 480
const CAMERA_LOCATE_MS = 620

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function isRejected(status?: string): boolean {
  return status === 'rejected'
}

function isPending(status?: string): boolean {
  return status === 'pending'
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number
) {
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

export const GraphForceCanvas: React.FC<{
  nodes: GraphCanvasNode[]
  edges: GraphCanvasEdge[]
  highlightIds?: Set<string>
  /** Selected node + 1-hop neighbors for focus dimming / labels. */
  focusIds?: Set<string>
  selectedId?: string | null
  onSelectNode?: (id: string) => void
  /** Click empty canvas (no drag) clears focus / selection. */
  onClearSelection?: () => void
  forceSettings?: GraphForceSettings
  appearanceSettings?: GraphAppearanceSettings
  animationTick?: number
  /** Bump to pan+zoom the current selectedId into view (e.g. pending「查看」). */
  locateSeq?: number
}> = ({
  nodes,
  edges,
  highlightIds,
  focusIds,
  selectedId,
  onSelectNode,
  onClearSelection,
  forceSettings = GRAPH_FORCE_DEFAULTS,
  appearanceSettings = GRAPH_APPEARANCE_DEFAULTS,
  animationTick = 0,
  locateSeq = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const linksRef = useRef<SimLink[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const forceRef = useRef<GraphForceSettings>(forceSettings)
  const appearanceRef = useRef<GraphAppearanceSettings>(appearanceSettings)
  const dragRef = useRef<{
    id: string | null
    pan: boolean
    dragging: boolean
    pointerId: number | null
    lastX: number
    lastY: number
    startX: number
    startY: number
  }>({
    id: null,
    pan: false,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
    startX: 0,
    startY: 0
  })
  const highlightRef = useRef(highlightIds)
  const focusRef = useRef(focusIds)
  const selectedRef = useRef(selectedId)
  const onSelectRef = useRef(onSelectNode)
  const onClearRef = useRef(onClearSelection)
  const drawRef = useRef<() => void>(() => {})
  const centerRafRef = useRef<number | null>(null)
  const locateSeqRef = useRef(locateSeq)
  const pendingZoomRef = useRef(false)
  /** True while scripted pan/zoom easing is running. */
  const cameraAnimRef = useRef(false)
  /** Keep selected node screen-centered until this timestamp (ms). */
  const followUntilRef = useRef(0)
  const graphFpRef = useRef('')

  // Sync locate intent during render so topology rebuild in the same commit can seed/center.
  if (locateSeq !== locateSeqRef.current) {
    locateSeqRef.current = locateSeq
    if (locateSeq > 0) {
      pendingZoomRef.current = true
      followUntilRef.current = performance.now() + 1600
    }
  }

  const cameraTargetForSelected = (k: number): { x: number; y: number; k: number } | null => {
    const canvas = canvasRef.current
    const selected = selectedRef.current
    if (!canvas || !selected) return null
    const n = nodesRef.current.find((x) => x.id === selected)
    if (!n || n.x == null || n.y == null) return null
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w <= 0 || h <= 0) return null
    return {
      x: w / 2 - n.x * k,
      y: h / 2 - n.y * k,
      k
    }
  }

  /** Soft-follow (or hard-set when alpha>=1) toward the selected node. */
  const easeCameraTowardSelected = (opts?: { k?: number; alpha?: number }) => {
    const k = opts?.k ?? transformRef.current.k
    const target = cameraTargetForSelected(k)
    if (!target) return false
    const alpha = opts?.alpha ?? 1
    if (alpha >= 1) {
      transformRef.current.x = target.x
      transformRef.current.y = target.y
      transformRef.current.k = target.k
      return true
    }
    transformRef.current.x += (target.x - transformRef.current.x) * alpha
    transformRef.current.y += (target.y - transformRef.current.y) * alpha
    transformRef.current.k += (target.k - transformRef.current.k) * alpha
    return true
  }

  useEffect(() => {
    forceRef.current = forceSettings
  }, [forceSettings])

  useEffect(() => {
    appearanceRef.current = appearanceSettings
    drawRef.current()
  }, [appearanceSettings])

  useEffect(() => {
    highlightRef.current = highlightIds
  }, [highlightIds])

  useEffect(() => {
    focusRef.current = focusIds
    drawRef.current()
  }, [focusIds])

  useEffect(() => {
    selectedRef.current = selectedId
  }, [selectedId])

  useEffect(() => {
    onSelectRef.current = onSelectNode
  }, [onSelectNode])

  useEffect(() => {
    onClearRef.current = onClearSelection
  }, [onClearSelection])

  // Canvas chrome (resize) mounts once; simulation lifecycle is separate.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const parent = canvas.parentElement
      const w = Math.max(1, parent?.clientWidth ?? 800)
      const h = Math.max(1, parent?.clientHeight ?? 600)
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const sim = simRef.current
      if (sim) {
        const fx = sim.force('x') as ForceX<SimNode> | undefined
        const fy = sim.force('y') as ForceY<SimNode> | undefined
        fx?.x(w / 2)
        fy?.y(h / 2)
      }
      drawRef.current()
    }

    resize()
    const ro =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('resize', resize)
    return () => {
      window.removeEventListener('resize', resize)
      ro?.disconnect()
      simRef.current?.stop()
      simRef.current = null
      graphFpRef.current = ''
    }
  }, [])

  // Simulation depends only on graph topology — soft-patch metadata when ids unchanged.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w <= 0 || h <= 0) return

      // Soft-follow after scripted animation (skip while easing to avoid fighting it).
      if (
        !cameraAnimRef.current &&
        followUntilRef.current > performance.now() &&
        selectedRef.current
      ) {
        easeCameraTowardSelected({
          k: pendingZoomRef.current
            ? Math.max(transformRef.current.k, LOCATE_TARGET_K)
            : undefined,
          alpha: CAMERA_FOLLOW_LERP
        })
      } else if (pendingZoomRef.current && followUntilRef.current <= performance.now()) {
        pendingZoomRef.current = false
      }

      ctx.clearRect(0, 0, w, h)
      const { x: tx, y: ty, k } = transformRef.current
      const highlights = highlightRef.current
      const selected = selectedRef.current
      const focus = focusRef.current
      const appearance = appearanceRef.current
      const nodeScale = appearance.nodeSize
      const lineScale = appearance.lineThickness
      const textAlpha = appearance.textOpacity
      const focusing = Boolean(selected && focus && focus.size > 0)

      ctx.save()
      ctx.translate(tx, ty)
      ctx.scale(k, k)

      ctx.lineWidth = (1 * lineScale) / k
      for (const link of linksRef.current) {
        const s = link.source as SimNode
        const t = link.target as SimNode
        if (s.x == null || t.x == null || s.y == null || t.y == null) continue
        const pending = isPending(link.reviewStatus)
        const incident =
          !focusing ||
          s.id === selected ||
          t.id === selected ||
          (focus?.has(s.id) === true && focus?.has(t.id) === true)
        if (focusing && !incident) continue
        const stroke = pending
          ? focusing
            ? 'rgba(100,116,139,0.28)'
            : 'rgba(100,116,139,0.22)'
          : focusing
            ? 'rgba(100,116,139,0.55)'
            : 'rgba(100,116,139,0.45)'
        ctx.globalAlpha = 1
        ctx.strokeStyle = stroke
        ctx.fillStyle = stroke
        ctx.setLineDash(pending ? [4 / k, 4 / k] : [])
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.stroke()
        if (appearance.showArrows && !pending) {
          drawArrowHead(ctx, s.x, s.y, t.x, t.y, (6 * lineScale) / k)
        }
      }
      ctx.setLineDash([])

      const degreeById = new Map<string, number>()
      for (const link of linksRef.current) {
        const sid =
          typeof link.source === 'object' && link.source
            ? (link.source as SimNode).id
            : String(link.source)
        const tid =
          typeof link.target === 'object' && link.target
            ? (link.target as SimNode).id
            : String(link.target)
        degreeById.set(sid, (degreeById.get(sid) ?? 0) + 1)
        degreeById.set(tid, (degreeById.get(tid) ?? 0) + 1)
      }

      for (const n of nodesRef.current) {
        if (n.x == null || n.y == null) continue
        const r = (6 + Math.min(10, (n.mentionCount ?? 1) * 1.2)) * nodeScale
        const highlighted = highlights?.has(n.id) || n.id === selected
        const pending = isPending(n.reviewStatus)
        const inFocus = !focusing || focus?.has(n.id) === true
        const dim = focusing && !inFocus
        const isHub =
          (degreeById.get(n.id) ?? 0) > appearance.hubLabelMinDegree ||
          (n.mentionCount ?? 0) >= appearance.hubLabelMinMentions
        ctx.globalAlpha = dim ? 0.1 : pending ? 0.45 : 1
        ctx.beginPath()
        ctx.fillStyle = TYPE_COLORS[n.nodeType] || '#64748b'
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()
        if (pending && inFocus) {
          ctx.setLineDash([3 / k, 3 / k])
          ctx.strokeStyle = 'rgba(15,23,42,0.55)'
          ctx.lineWidth = (1.5 * lineScale) / k
          ctx.stroke()
          ctx.setLineDash([])
        } else if (highlighted) {
          ctx.strokeStyle = '#0f172a'
          ctx.lineWidth = (2.5 * lineScale) / k
          ctx.stroke()
        }
        const showLabel =
          textAlpha > 0.01 &&
          !dim &&
          (n.id === selected ||
            highlights?.has(n.id) === true ||
            (focusing && inFocus) ||
            isHub)
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
    drawRef.current = draw

    const nextNodes = nodes.filter((n) => !isRejected(n.reviewStatus))
    const nextIdSet = new Set(nextNodes.map((n) => n.id))
    const nextLinks = edges
      .filter((e) => !isRejected(e.reviewStatus) && nextIdSet.has(e.fromId) && nextIdSet.has(e.toId))
      .map((e) => ({
        id: e.id,
        edgeType: e.edgeType,
        reviewStatus: e.reviewStatus,
        source: e.fromId,
        target: e.toId
      }))
    const fp = `${[...nextIdSet].sort().join(',')}|${nextLinks
      .map((l) => l.id)
      .sort()
      .join(',')}`

    // Same topology: patch fields in place — keep layout & camera.
    if (fp === graphFpRef.current && simRef.current) {
      const byId = new Map(nextNodes.map((n) => [n.id, n]))
      for (const n of nodesRef.current) {
        const fresh = byId.get(n.id)
        if (!fresh) continue
        n.name = fresh.name
        n.nodeType = fresh.nodeType
        n.mentionCount = fresh.mentionCount
        n.reviewStatus = fresh.reviewStatus
      }
      const linkMeta = new Map(nextLinks.map((l) => [l.id, l]))
      for (const l of linksRef.current) {
        const fresh = linkMeta.get(l.id)
        if (!fresh) continue
        l.edgeType = fresh.edgeType
        l.reviewStatus = fresh.reviewStatus
      }
      draw()
      return
    }

    graphFpRef.current = fp
    const prevById = new Map(nodesRef.current.map((n) => [n.id, n]))
    const cx = Math.max(1, canvas.clientWidth) / 2
    const cy = Math.max(1, canvas.clientHeight) / 2
    const locating = followUntilRef.current > performance.now() || pendingZoomRef.current
    const selected = selectedRef.current

    const simNodes: SimNode[] = nextNodes.map((n) => {
      const prev = prevById.get(n.id)
      // New nodes / locate jumps: seed near viewport center so camera doesn't chase a corner.
      let x = prev?.x
      let y = prev?.y
      if (x == null || y == null || (locating && n.id === selected)) {
        if (n.id === selected) {
          x = cx
          y = cy
        } else {
          // Random disk (not a fixed ring) so charge+center don't lock into concentric shells.
          const spread = Math.min(280, 80 + Math.sqrt(nextNodes.length) * 12)
          const angle = Math.random() * Math.PI * 2
          const rad = Math.sqrt(Math.random()) * spread
          x = cx + Math.cos(angle) * rad
          y = cy + Math.sin(angle) * rad
        }
      }
      return {
        ...n,
        x,
        y,
        vx: locating ? 0 : prev?.vx,
        vy: locating ? 0 : prev?.vy
      }
    })
    const simLinks: SimLink[] = nextLinks.map((e) => ({ ...e }))

    nodesRef.current = simNodes
    linksRef.current = simLinks

    const forces = forceRef.current

    simRef.current?.stop()
    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(forces.linkDistance)
          .strength(forces.linkStrength)
      )
      .force('charge', forceManyBody().strength(forces.chargeStrength))
      .force('x', forceX(cx).strength(forces.centerStrength))
      .force('y', forceY(cy).strength(forces.centerStrength))
      .force(
        'collide',
        forceCollide<SimNode>().radius(
          (d) => (10 + Math.min(12, (d.mentionCount ?? 1) * 1.5)) * appearanceRef.current.nodeSize
        )
      )
      .on('tick', draw)

    simRef.current = sim
    // Locate: keep current camera; selection effect eases pan/zoom to the seeded node.
    draw()
  }, [nodes, edges])

  // Live-update forces without rebuilding the whole simulation.
  useEffect(() => {
    const sim = simRef.current
    if (!sim) return
    const link = sim.force('link') as ForceLink<SimNode, SimLink> | undefined
    const charge = sim.force('charge') as ForceManyBody<SimNode> | undefined
    const fx = sim.force('x') as ForceX<SimNode> | undefined
    const fy = sim.force('y') as ForceY<SimNode> | undefined
    link?.strength(forceSettings.linkStrength)
    link?.distance(forceSettings.linkDistance)
    charge?.strength(forceSettings.chargeStrength)
    fx?.strength(forceSettings.centerStrength)
    fy?.strength(forceSettings.centerStrength)
    sim.alpha(0.35).restart()
  }, [
    forceSettings.centerStrength,
    forceSettings.linkStrength,
    forceSettings.chargeStrength,
    forceSettings.linkDistance
  ])

  useEffect(() => {
    if (animationTick <= 0) return
    const sim = simRef.current
    if (!sim) return
    // Visible re-layout: scatter nodes slightly then reheat the simulation.
    const jitter = 48
    for (const n of nodesRef.current) {
      if (n.x == null || n.y == null) continue
      n.x += (Math.random() - 0.5) * jitter * 2
      n.y += (Math.random() - 0.5) * jitter * 2
      n.vx = (Math.random() - 0.5) * 12
      n.vy = (Math.random() - 0.5) * 12
    }
    sim.alpha(1).alphaTarget(0).restart()
    drawRef.current()
  }, [animationTick])

  // Smooth camera: ease pan (+ optional zoom) to the selected node, then soft-follow.
  useEffect(() => {
    if (!selectedId) {
      pendingZoomRef.current = false
      followUntilRef.current = 0
      cameraAnimRef.current = false
      drawRef.current()
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const withZoom = pendingZoomRef.current
    const from = { ...transformRef.current }
    const targetK = withZoom ? Math.max(from.k, LOCATE_TARGET_K) : from.k
    const duration = withZoom ? CAMERA_LOCATE_MS : CAMERA_CENTER_MS

    if (centerRafRef.current != null) {
      cancelAnimationFrame(centerRafRef.current)
      centerRafRef.current = null
    }

    if (withZoom) {
      followUntilRef.current = Math.max(followUntilRef.current, performance.now() + 1400)
    }

    let cancelled = false
    let waitTimer: number | null = null

    const runEase = () => {
      if (cancelled) return
      cameraAnimRef.current = true
      const start = performance.now()

      const step = (now: number) => {
        if (cancelled) return
        const t = Math.min(1, (now - start) / duration)
        const ease = easeOutCubic(t)
        const k = from.k + (targetK - from.k) * ease
        const desired = cameraTargetForSelected(k)
        if (!desired) {
          centerRafRef.current = requestAnimationFrame(step)
          return
        }
        transformRef.current.x = from.x + (desired.x - from.x) * ease
        transformRef.current.y = from.y + (desired.y - from.y) * ease
        transformRef.current.k = k
        drawRef.current()
        if (t < 1) {
          centerRafRef.current = requestAnimationFrame(step)
          return
        }
        centerRafRef.current = null
        cameraAnimRef.current = false
        followUntilRef.current = Math.max(followUntilRef.current, performance.now() + 900)
      }

      centerRafRef.current = requestAnimationFrame(step)
    }

    if (cameraTargetForSelected(from.k)) {
      runEase()
    } else {
      let tries = 0
      waitTimer = window.setInterval(() => {
        tries += 1
        if (cameraTargetForSelected(from.k) || tries >= 40) {
          if (waitTimer != null) {
            window.clearInterval(waitTimer)
            waitTimer = null
          }
          if (tries < 40 && !cancelled) runEase()
        }
      }, 40)
    }

    return () => {
      cancelled = true
      cameraAnimRef.current = false
      if (waitTimer != null) window.clearInterval(waitTimer)
      if (centerRafRef.current != null) {
        cancelAnimationFrame(centerRafRef.current)
        centerRafRef.current = null
      }
    }
  }, [selectedId, locateSeq])

  useEffect(() => {
    drawRef.current()
  }, [highlightIds, selectedId, focusIds])

  // Pointer handlers mount once; callbacks read latest via refs.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const toWorld = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect()
      const { x: tx, y: ty, k } = transformRef.current
      return {
        x: (clientX - rect.left - tx) / k,
        y: (clientY - rect.top - ty) / k
      }
    }

    const findNode = (x: number, y: number) => {
      const nodeScale = appearanceRef.current.nodeSize
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const n = nodesRef.current[i]!
        if (n.x == null || n.y == null) continue
        const r = (8 + Math.min(10, (n.mentionCount ?? 1) * 1.2)) * nodeScale
        const dx = n.x - x
        const dy = n.y - y
        if (dx * dx + dy * dy <= r * r) return n
      }
      return null
    }

    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      const p = toWorld(ev.clientX, ev.clientY)
      const hit = findNode(p.x, p.y)
      try {
        canvas.setPointerCapture(ev.pointerId)
      } catch {
        // ignore capture failures
      }
      if (hit) {
        dragRef.current = {
          id: hit.id,
          pan: false,
          dragging: false,
          pointerId: ev.pointerId,
          lastX: ev.clientX,
          lastY: ev.clientY,
          startX: ev.clientX,
          startY: ev.clientY
        }
        onSelectRef.current?.(hit.id)
        // Do not restart simulation on click — only when user actually drags.
      } else {
        dragRef.current = {
          id: null,
          pan: true,
          dragging: false,
          pointerId: ev.pointerId,
          lastX: ev.clientX,
          lastY: ev.clientY,
          startX: ev.clientX,
          startY: ev.clientY
        }
      }
      canvas.style.cursor = 'move'
    }

    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (drag.pointerId != null && ev.pointerId !== drag.pointerId) return
      if (drag.pointerId == null) {
        const p = toWorld(ev.clientX, ev.clientY)
        canvas.style.cursor = findNode(p.x, p.y) ? 'pointer' : 'move'
        return
      }
      canvas.style.cursor = 'move'
      if (drag.pan) {
        const dist = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY)
        if (!drag.dragging) {
          if (dist < DRAG_THRESHOLD_PX) return
          drag.dragging = true
        }
        transformRef.current.x += ev.clientX - drag.lastX
        transformRef.current.y += ev.clientY - drag.lastY
        drag.lastX = ev.clientX
        drag.lastY = ev.clientY
        drawRef.current()
        return
      }
      if (!drag.id) return
      const dist = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY)
      if (!drag.dragging) {
        if (dist < DRAG_THRESHOLD_PX) return
        drag.dragging = true
        const n = nodesRef.current.find((x) => x.id === drag.id)
        if (n) {
          n.fx = n.x
          n.fy = n.y
        }
        simRef.current?.alphaTarget(0.25).restart()
      }
      const p = toWorld(ev.clientX, ev.clientY)
      const n = nodesRef.current.find((x) => x.id === drag.id)
      if (!n) return
      n.fx = p.x
      n.fy = p.y
      drawRef.current()
    }

    const endDrag = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (drag.pointerId != null && ev.pointerId !== drag.pointerId) return
      if (drag.pointerId != null) {
        try {
          canvas.releasePointerCapture(drag.pointerId)
        } catch {
          // ignore
        }
      }
      if (drag.pan && !drag.dragging) {
        onClearRef.current?.()
      }
      if (drag.id && drag.dragging) {
        const n = nodesRef.current.find((x) => x.id === drag.id)
        if (n) {
          n.fx = null
          n.fy = null
        }
        simRef.current?.alphaTarget(0)
      }
      dragRef.current = {
        id: null,
        pan: false,
        dragging: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
        startX: 0,
        startY: 0
      }
      canvas.style.cursor = 'move'
      drawRef.current()
    }

    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const mx = ev.clientX - rect.left
      const my = ev.clientY - rect.top
      const { x: tx, y: ty, k: k0 } = transformRef.current
      const factor = ev.deltaY > 0 ? 0.9 : 1.1
      const k1 = Math.min(3, Math.max(0.3, k0 * factor))
      if (k1 === k0) return
      transformRef.current.x = mx - ((mx - tx) * k1) / k0
      transformRef.current.y = my - ((my - ty) * k1) / k0
      transformRef.current.k = k1
      drawRef.current()
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)
    canvas.addEventListener('lostpointercapture', endDrag)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
      canvas.removeEventListener('lostpointercapture', endDrag)
      canvas.removeEventListener('wheel', onWheel)
      dragRef.current = {
        id: null,
        pan: false,
        dragging: false,
        pointerId: null,
        lastX: 0,
        lastY: 0,
        startX: 0,
        startY: 0
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'move', touchAction: 'none' }}
    />
  )
}
