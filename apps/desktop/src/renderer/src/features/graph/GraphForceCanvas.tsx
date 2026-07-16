import React, { useEffect, useRef } from 'react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum
} from 'd3-force'

export interface GraphCanvasNode {
  id: string
  name: string
  nodeType: string
  mentionCount?: number
}

export interface GraphCanvasEdge {
  id: string
  fromId: string
  toId: string
  edgeType: string
}

type SimNode = SimulationNodeDatum & GraphCanvasNode
type SimLink = SimulationLinkDatum<SimNode> & { id: string; edgeType: string }

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

export const GraphForceCanvas: React.FC<{
  nodes: GraphCanvasNode[]
  edges: GraphCanvasEdge[]
  highlightIds?: Set<string>
  selectedId?: string | null
  onSelectNode?: (id: string) => void
}> = ({ nodes, edges, highlightIds, selectedId, onSelectNode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const linksRef = useRef<SimLink[]>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const dragRef = useRef<{ id: string | null; pan: boolean; lastX: number; lastY: number }>({
    id: null,
    pan: false,
    lastX: 0,
    lastY: 0
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const parent = canvas.parentElement
      const w = parent?.clientWidth ?? 800
      const h = parent?.clientHeight ?? 600
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const simNodes: SimNode[] = nodes.map((n) => ({ ...n }))
    const idSet = new Set(simNodes.map((n) => n.id))
    const simLinks: SimLink[] = edges
      .filter((e) => idSet.has(e.fromId) && idSet.has(e.toId))
      .map((e) => ({
        id: e.id,
        edgeType: e.edgeType,
        source: e.fromId,
        target: e.toId
      }))

    nodesRef.current = simNodes
    linksRef.current = simLinks

    simRef.current?.stop()
    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(70)
          .strength(0.4)
      )
      .force('charge', forceManyBody().strength(-180))
      .force('center', forceCenter((canvas.width || 800) / (2 * (window.devicePixelRatio || 1)), (canvas.height || 600) / (2 * (window.devicePixelRatio || 1))))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => 10 + Math.min(12, (d.mentionCount ?? 1) * 1.5))
      )
      .on('tick', draw)

    simRef.current = sim

    function draw() {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      const { x: tx, y: ty, k } = transformRef.current
      ctx.save()
      ctx.translate(tx, ty)
      ctx.scale(k, k)

      ctx.strokeStyle = 'rgba(100,116,139,0.35)'
      ctx.lineWidth = 1 / k
      for (const link of linksRef.current) {
        const s = link.source as SimNode
        const t = link.target as SimNode
        if (s.x == null || t.x == null) continue
        ctx.beginPath()
        ctx.moveTo(s.x, s.y!)
        ctx.lineTo(t.x, t.y!)
        ctx.stroke()
      }

      for (const n of nodesRef.current) {
        if (n.x == null || n.y == null) continue
        const r = 6 + Math.min(10, (n.mentionCount ?? 1) * 1.2)
        const highlighted = highlightIds?.has(n.id) || n.id === selectedId
        ctx.beginPath()
        ctx.fillStyle = TYPE_COLORS[n.nodeType] || '#64748b'
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
        ctx.fill()
        if (highlighted) {
          ctx.strokeStyle = '#0f172a'
          ctx.lineWidth = 2 / k
          ctx.stroke()
        }
        ctx.fillStyle = '#0f172a'
        ctx.font = `${12 / k}px sans-serif`
        ctx.fillText(n.name.slice(0, 16), n.x + r + 2, n.y + 4)
      }
      ctx.restore()
    }

    return () => {
      window.removeEventListener('resize', resize)
      sim.stop()
    }
  }, [nodes, edges, highlightIds, selectedId])

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
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const n = nodesRef.current[i]!
        if (n.x == null || n.y == null) continue
        const r = 8 + Math.min(10, (n.mentionCount ?? 1) * 1.2)
        const dx = n.x - x
        const dy = n.y - y
        if (dx * dx + dy * dy <= r * r) return n
      }
      return null
    }

    const onDown = (ev: PointerEvent) => {
      const p = toWorld(ev.clientX, ev.clientY)
      const hit = findNode(p.x, p.y)
      if (hit) {
        dragRef.current = { id: hit.id, pan: false, lastX: ev.clientX, lastY: ev.clientY }
        hit.fx = hit.x
        hit.fy = hit.y
        onSelectNode?.(hit.id)
        simRef.current?.alphaTarget(0.3).restart()
      } else {
        dragRef.current = { id: null, pan: true, lastX: ev.clientX, lastY: ev.clientY }
      }
    }
    const onMove = (ev: PointerEvent) => {
      const drag = dragRef.current
      if (drag.pan) {
        transformRef.current.x += ev.clientX - drag.lastX
        transformRef.current.y += ev.clientY - drag.lastY
        drag.lastX = ev.clientX
        drag.lastY = ev.clientY
        simRef.current?.tick()
        return
      }
      if (!drag.id) return
      const p = toWorld(ev.clientX, ev.clientY)
      const n = nodesRef.current.find((x) => x.id === drag.id)
      if (!n) return
      n.fx = p.x
      n.fy = p.y
    }
    const onUp = () => {
      const id = dragRef.current.id
      if (id) {
        const n = nodesRef.current.find((x) => x.id === id)
        if (n) {
          n.fx = null
          n.fy = null
        }
        simRef.current?.alphaTarget(0)
      }
      dragRef.current = { id: null, pan: false, lastX: 0, lastY: 0 }
    }
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault()
      const factor = ev.deltaY > 0 ? 0.9 : 1.1
      transformRef.current.k = Math.min(3, Math.max(0.3, transformRef.current.k * factor))
    }

    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [onSelectNode])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }} />
}
