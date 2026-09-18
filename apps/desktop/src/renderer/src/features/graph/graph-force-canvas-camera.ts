import {
  easeOutCubic,
  graphCanvasCameraFitIds,
  graphForceCameraTargetForPoints,
  GRAPH_CANVAS_CAMERA_CENTER_MS,
  GRAPH_CANVAS_CAMERA_LOCATE_MS,
  GRAPH_CANVAS_LOCATE_TARGET_K
} from './graph-force-canvas.util'
import type { GraphForceCanvasEngineRefs } from './graph-force-canvas-engine.types'

export function graphForceCameraTargetForIds(
  refs: GraphForceCanvasEngineRefs,
  ids: string[],
  k: number
): { x: number; y: number; k: number } | null {
  const canvas = refs.canvasRef.current
  if (!canvas || ids.length === 0) return null
  const pts: Array<{ x: number; y: number }> = []
  for (const id of ids) {
    const n = refs.nodesRef.current.find((x) => x.id === id)
    if (!n || n.x == null || n.y == null) continue
    pts.push({ x: n.x, y: n.y })
  }
  return graphForceCameraTargetForPoints(pts, canvas.clientWidth, canvas.clientHeight, k)
}

export function easeGraphForceCameraTowardSelected(
  refs: GraphForceCanvasEngineRefs,
  opts?: { k?: number; alpha?: number }
): boolean {
  const ids = graphCanvasCameraFitIds(refs.locateIdsRef.current, refs.selectedRef.current)
  const k = opts?.k ?? refs.transformRef.current.k
  const target = graphForceCameraTargetForIds(refs, ids, k)
  if (!target) return false
  const alpha = opts?.alpha ?? 1
  if (alpha >= 1) {
    refs.transformRef.current.x = target.x
    refs.transformRef.current.y = target.y
    refs.transformRef.current.k = target.k
    return true
  }
  refs.transformRef.current.x += (target.x - refs.transformRef.current.x) * alpha
  refs.transformRef.current.y += (target.y - refs.transformRef.current.y) * alpha
  refs.transformRef.current.k += (target.k - refs.transformRef.current.k) * alpha
  return true
}

export function startGraphForceCameraEase(
  refs: GraphForceCanvasEngineRefs,
  opts: { selectedId?: string | null; locateIds?: string[] }
): () => void {
  const fitIds = graphCanvasCameraFitIds(opts.locateIds, opts.selectedId)
  if (fitIds.length === 0) {
    refs.pendingZoomRef.current = false
    refs.followUntilRef.current = 0
    refs.cameraAnimRef.current = false
    refs.drawRef.current()
    return () => undefined
  }
  if (refs.interactingRef.current) return () => undefined
  const canvas = refs.canvasRef.current
  if (!canvas) return () => undefined
  const withZoom = refs.pendingZoomRef.current
  const from = { ...refs.transformRef.current }
  const targetK = withZoom ? Math.max(from.k, GRAPH_CANVAS_LOCATE_TARGET_K) : from.k
  const duration = withZoom ? GRAPH_CANVAS_CAMERA_LOCATE_MS : GRAPH_CANVAS_CAMERA_CENTER_MS

  if (refs.centerRafRef.current != null) {
    cancelAnimationFrame(refs.centerRafRef.current)
    refs.centerRafRef.current = null
  }

  refs.suppressCameraRef.current = false
  if (withZoom) {
    refs.followUntilRef.current = Math.max(refs.followUntilRef.current, performance.now() + 1400)
  }

  let cancelled = false
  let waitTimer: number | null = null

  const runEase = () => {
    if (cancelled || refs.suppressCameraRef.current || refs.interactingRef.current) return
    refs.cameraAnimRef.current = true
    const start = performance.now()

    const step = (now: number) => {
      if (cancelled || refs.suppressCameraRef.current || refs.interactingRef.current) {
        refs.cameraAnimRef.current = false
        refs.centerRafRef.current = null
        return
      }
      const t = Math.min(1, (now - start) / duration)
      const ease = easeOutCubic(t)
      const desired = graphForceCameraTargetForIds(refs, fitIds, targetK)
      if (!desired) {
        refs.centerRafRef.current = requestAnimationFrame(step)
        return
      }
      refs.transformRef.current.x = from.x + (desired.x - from.x) * ease
      refs.transformRef.current.y = from.y + (desired.y - from.y) * ease
      refs.transformRef.current.k = from.k + (desired.k - from.k) * ease
      refs.drawRef.current()
      if (t < 1) {
        refs.centerRafRef.current = requestAnimationFrame(step)
        return
      }
      refs.centerRafRef.current = null
      refs.cameraAnimRef.current = false
      refs.followUntilRef.current = Math.max(refs.followUntilRef.current, performance.now() + 900)
    }

    refs.centerRafRef.current = requestAnimationFrame(step)
  }

  if (graphForceCameraTargetForIds(refs, fitIds, from.k)) {
    runEase()
  } else {
    let tries = 0
    waitTimer = window.setInterval(() => {
      tries += 1
      if (graphForceCameraTargetForIds(refs, fitIds, from.k) || tries >= 40) {
        if (waitTimer != null) {
          window.clearInterval(waitTimer)
          waitTimer = null
        }
        if (tries < 40 && !cancelled && !refs.interactingRef.current) runEase()
      }
    }, 40)
  }

  return () => {
    cancelled = true
    refs.cameraAnimRef.current = false
    if (waitTimer != null) window.clearInterval(waitTimer)
    if (refs.centerRafRef.current != null) {
      cancelAnimationFrame(refs.centerRafRef.current)
      refs.centerRafRef.current = null
    }
  }
}
