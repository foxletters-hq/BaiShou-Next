import React, { useEffect, useRef, useState } from 'react'
import { type Simulation } from 'd3-force'
import type { GraphForceSimLink, GraphForceSimNode } from './graph-force-canvas.types'
import {
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_FORCE_DEFAULTS,
  type GraphAppearanceSettings,
  type GraphForceSettings
} from '@baishou/shared'
import { bindGraphForceCanvasPointer } from './bind-graph-force-canvas-pointer'
import { drawGraphForceFrame } from './graph-force-canvas-draw'
import {
  easeGraphForceCameraTowardSelected,
  startGraphForceCameraEase
} from './graph-force-canvas-camera'
import {
  applyGraphForceCenter,
  applyGraphForceStrengths,
  rebuildGraphForceSimulation
} from './graph-force-canvas-simulation'
import type { GraphForceCanvasEngineRefs } from './graph-force-canvas-engine.types'
import type { GraphCanvasEdge, GraphCanvasNode } from './graph-force-canvas.types'
import {
  GRAPH_CANVAS_CAMERA_FOLLOW_LERP,
  GRAPH_CANVAS_LOCATE_TARGET_K,
  seedGraphForceNodePosition
} from './graph-force-canvas.util'

export type { GraphCanvasEdge, GraphCanvasNode } from './graph-force-canvas.types'

export const GraphForceCanvas: React.FC<{
  /** 标签页切走时停力导向 tick，避免隐藏画布继续占 CPU。 */
  paused?: boolean
  nodes: GraphCanvasNode[]
  edges: GraphCanvasEdge[]
  highlightIds?: Set<string>
  /** Selected node + 1-hop neighbors for focus dimming / labels. */
  focusIds?: Set<string>
  selectedId?: string | null
  /** Extra rings for merge-mode multi-select. */
  selectedIds?: Set<string>
  /** Highlight specific edges (pending relation「查看」). */
  highlightEdgeIds?: Set<string>
  /** Camera-fit these node ids on locateSeq (relation pair). */
  locateIds?: string[]
  onSelectNode?: (id: string) => void
  /** Click empty canvas (no drag) clears focus / selection. */
  onClearSelection?: () => void
  forceSettings?: GraphForceSettings
  appearanceSettings?: GraphAppearanceSettings
  animationTick?: number
  /** Bump to pan+zoom the current selectedId into view (e.g. pending「查看」). */
  locateSeq?: number
}> = ({
  paused = false,
  nodes,
  edges,
  highlightIds,
  focusIds,
  selectedId,
  selectedIds,
  highlightEdgeIds,
  locateIds,
  onSelectNode,
  onClearSelection,
  forceSettings = GRAPH_FORCE_DEFAULTS,
  appearanceSettings = GRAPH_APPEARANCE_DEFAULTS,
  animationTick = 0,
  locateSeq = 0
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<Simulation<GraphForceSimNode, GraphForceSimLink> | null>(null)
  const nodesRef = useRef<GraphForceCanvasEngineRefs['nodesRef']['current']>([])
  const linksRef = useRef<GraphForceCanvasEngineRefs['linksRef']['current']>([])
  const transformRef = useRef({ x: 0, y: 0, k: 1 })
  const forceRef = useRef<GraphForceSettings>(forceSettings)
  const appearanceRef = useRef<GraphAppearanceSettings>(appearanceSettings)
  const dragRef = useRef<GraphForceCanvasEngineRefs['dragRef']['current']>({
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
  const selectedIdsRef = useRef(selectedIds)
  const highlightEdgeRef = useRef(highlightEdgeIds)
  const locateIdsRef = useRef(locateIds)
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
  /** User is dragging a node or panning; do not fight the pointer with camera follow. */
  const suppressCameraRef = useRef(false)
  /** Pointer is down; async select must not start camera follow until the gesture ends. */
  const interactingRef = useRef(false)
  const kickFollowRef = useRef<() => void>(() => {})
  const easeCameraTowardSelectedRef = useRef<(opts?: { k?: number; alpha?: number }) => boolean>(
    () => false
  )
  const [followKick, setFollowKick] = useState(0)
  const graphFpRef = useRef('')
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const degreeByIdRef = useRef(new Map<string, number>())
  const engineRefsRef = useRef<GraphForceCanvasEngineRefs | null>(null)
  if (!engineRefsRef.current) {
    engineRefsRef.current = {
      canvasRef,
      simRef,
      nodesRef,
      linksRef,
      transformRef,
      forceRef,
      appearanceRef,
      dragRef,
      highlightRef,
      focusRef,
      selectedRef,
      selectedIdsRef,
      highlightEdgeRef,
      locateIdsRef,
      onSelectRef,
      onClearRef,
      drawRef,
      centerRafRef,
      locateSeqRef,
      pendingZoomRef,
      cameraAnimRef,
      followUntilRef,
      suppressCameraRef,
      interactingRef,
      kickFollowRef,
      easeCameraTowardSelectedRef,
      graphFpRef,
      degreeByIdRef
    }
  }
  const refs = engineRefsRef.current

  kickFollowRef.current = () => {
    if (interactingRef.current) return
    setFollowKick((n) => n + 1)
  }

  // Sync locate intent during render so topology rebuild in the same commit can seed/center.
  if (locateSeq !== locateSeqRef.current) {
    locateSeqRef.current = locateSeq
    if (locateSeq > 0) {
      pendingZoomRef.current = true
      followUntilRef.current = performance.now() + 1600
    }
  }

  easeCameraTowardSelectedRef.current = (opts) => easeGraphForceCameraTowardSelected(refs, opts)

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
    selectedIdsRef.current = selectedIds
    drawRef.current()
  }, [selectedIds])

  useEffect(() => {
    highlightEdgeRef.current = highlightEdgeIds
    drawRef.current()
  }, [highlightEdgeIds])

  useEffect(() => {
    locateIdsRef.current = locateIds
  }, [locateIds])

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
      if (sim) applyGraphForceCenter(sim, w / 2, h / 2)
      drawRef.current()
    }

    resize()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null
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

      const { x: tx0, y: ty0, k: k0 } = transformRef.current
      if (k0 > 0) {
        const wx = (w / 2 - tx0) / k0
        const wy = (h / 2 - ty0) / k0
        const sim = simRef.current
        if (sim) applyGraphForceCenter(sim, wx, wy)
      }

      // Soft-follow after scripted animation (skip while easing or user dragging).
      if (
        !interactingRef.current &&
        !suppressCameraRef.current &&
        !cameraAnimRef.current &&
        followUntilRef.current > performance.now() &&
        (locateIdsRef.current?.length || selectedRef.current)
      ) {
        easeCameraTowardSelectedRef.current({
          k: pendingZoomRef.current
            ? Math.max(transformRef.current.k, GRAPH_CANVAS_LOCATE_TARGET_K)
            : undefined,
          alpha: GRAPH_CANVAS_CAMERA_FOLLOW_LERP
        })
      } else if (pendingZoomRef.current && followUntilRef.current <= performance.now()) {
        pendingZoomRef.current = false
      }

      drawGraphForceFrame({
        ctx,
        width: w,
        height: h,
        transform: transformRef.current,
        nodes: nodesRef.current,
        links: linksRef.current,
        appearance: appearanceRef.current,
        highlightIds: highlightRef.current,
        highlightEdgeIds: highlightEdgeRef.current,
        focusIds: focusRef.current,
        selectedId: selectedRef.current,
        selectedIds: selectedIdsRef.current,
        degreeById: degreeByIdRef.current
      })
    }
    drawRef.current = draw

    rebuildGraphForceSimulation(refs, canvas, nodes, edges)
    if (pausedRef.current) {
      simRef.current?.stop()
      return
    }
    draw()
  }, [nodes, edges, refs])

  useEffect(() => {
    if (paused) {
      simRef.current?.stop()
      return
    }
    drawRef.current()
  }, [paused])

  // Live-update forces without rebuilding the whole simulation.
  useEffect(() => {
    const sim = simRef.current
    if (!sim || pausedRef.current) return
    applyGraphForceStrengths(sim, forceSettings, degreeByIdRef.current)
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
    if (!sim || pausedRef.current) return
    // Visible re-layout: isolated nodes re-seed around the cluster, others jitter.
    const canvas = canvasRef.current
    const cx = Math.max(1, canvas?.clientWidth ?? 800) / 2
    const cy = Math.max(1, canvas?.clientHeight ?? 600) / 2
    const isolatedCount = nodesRef.current.filter(
      (n) => (degreeByIdRef.current.get(n.id) ?? 0) <= 0
    ).length
    const jitter = 48
    for (const n of nodesRef.current) {
      if (n.x == null || n.y == null) continue
      if ((degreeByIdRef.current.get(n.id) ?? 0) <= 0) {
        const pos = seedGraphForceNodePosition({
          locating: false,
          isSelected: false,
          isolated: true,
          isolatedCount,
          cx,
          cy,
          nodeCount: nodesRef.current.length
        })
        n.x = pos.x
        n.y = pos.y
        n.vx = 0
        n.vy = 0
        continue
      }
      n.x += (Math.random() - 0.5) * jitter * 2
      n.y += (Math.random() - 0.5) * jitter * 2
      n.vx = (Math.random() - 0.5) * 12
      n.vy = (Math.random() - 0.5) * 12
    }
    sim.alpha(1).alphaTarget(0).restart()
    drawRef.current()
  }, [animationTick])

  // Smooth camera: ease pan (+ optional zoom) to the selected node, then soft-follow.
  // Skip while the pointer is down — async select must not fight a drag.
  useEffect(() => {
    return startGraphForceCameraEase(refs, { selectedId, locateIds })
  }, [selectedId, locateIds, locateSeq, followKick, refs])

  useEffect(() => {
    drawRef.current()
  }, [highlightIds, selectedId, selectedIds, focusIds, highlightEdgeIds])

  // Pointer handlers mount once; callbacks read latest via refs.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    return bindGraphForceCanvasPointer(canvas, refs)
  }, [refs])

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: 'move',
        touchAction: 'none'
      }}
    />
  )
}
