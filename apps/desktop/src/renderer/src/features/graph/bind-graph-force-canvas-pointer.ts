import {
  findGraphCanvasNodeAtPoint,
  graphCanvasApplyZoom,
  graphCanvasWorldPoint,
  GRAPH_CANVAS_DRAG_THRESHOLD_PX
} from './graph-force-canvas.util'
import type { GraphForceCanvasEngineRefs } from './graph-force-canvas-engine.types'

function stopCameraFollow(refs: GraphForceCanvasEngineRefs): void {
  refs.suppressCameraRef.current = true
  refs.cameraAnimRef.current = false
  refs.followUntilRef.current = 0
  refs.pendingZoomRef.current = false
  if (refs.centerRafRef.current != null) {
    cancelAnimationFrame(refs.centerRafRef.current)
    refs.centerRafRef.current = null
  }
}

export function bindGraphForceCanvasPointer(
  canvas: HTMLCanvasElement,
  refs: GraphForceCanvasEngineRefs
): () => void {
  const toWorld = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    return graphCanvasWorldPoint(clientX, clientY, rect, refs.transformRef.current)
  }

  const findNode = (x: number, y: number) =>
    findGraphCanvasNodeAtPoint(refs.nodesRef.current, x, y, refs.appearanceRef.current.nodeSize)

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return
    refs.interactingRef.current = true
    stopCameraFollow(refs)
    const p = toWorld(ev.clientX, ev.clientY)
    const hit = findNode(p.x, p.y)
    try {
      canvas.setPointerCapture(ev.pointerId)
    } catch {
      // ignore capture failures
    }
    if (hit) {
      refs.dragRef.current = {
        id: hit.id,
        pan: false,
        dragging: false,
        pointerId: ev.pointerId,
        lastX: ev.clientX,
        lastY: ev.clientY,
        startX: ev.clientX,
        startY: ev.clientY
      }
    } else {
      refs.dragRef.current = {
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
    const drag = refs.dragRef.current
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
        if (dist < GRAPH_CANVAS_DRAG_THRESHOLD_PX) return
        drag.dragging = true
        stopCameraFollow(refs)
      }
      refs.transformRef.current.x += ev.clientX - drag.lastX
      refs.transformRef.current.y += ev.clientY - drag.lastY
      drag.lastX = ev.clientX
      drag.lastY = ev.clientY
      refs.drawRef.current()
      return
    }
    if (!drag.id) return
    const dist = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY)
    if (!drag.dragging) {
      if (dist < GRAPH_CANVAS_DRAG_THRESHOLD_PX) return
      drag.dragging = true
      stopCameraFollow(refs)
      const n = refs.nodesRef.current.find((x) => x.id === drag.id)
      if (n) {
        n.fx = n.x
        n.fy = n.y
      }
      refs.simRef.current?.alphaTarget(0.25).restart()
    }
    const p = toWorld(ev.clientX, ev.clientY)
    const n = refs.nodesRef.current.find((x) => x.id === drag.id)
    if (!n) return
    n.fx = p.x
    n.fy = p.y
    refs.drawRef.current()
  }

  const endDrag = (ev: PointerEvent) => {
    const drag = refs.dragRef.current
    if (drag.pointerId == null) return
    if (ev.pointerId !== drag.pointerId) return
    const wasNodeClick = Boolean(drag.id) && !drag.dragging
    if (drag.pointerId != null) {
      try {
        canvas.releasePointerCapture(drag.pointerId)
      } catch {
        // ignore
      }
    }
    if (drag.pan && !drag.dragging) {
      refs.onClearRef.current?.()
    }
    if (drag.id && drag.dragging) {
      const n = refs.nodesRef.current.find((x) => x.id === drag.id)
      if (n) {
        n.fx = null
        n.fy = null
      }
      refs.simRef.current?.alphaTarget(0)
    }
    refs.dragRef.current = {
      id: null,
      pan: false,
      dragging: false,
      pointerId: null,
      lastX: 0,
      lastY: 0,
      startX: 0,
      startY: 0
    }
    refs.interactingRef.current = false
    if (wasNodeClick && drag.id) {
      if (refs.selectedRef.current === drag.id) refs.kickFollowRef.current()
      else refs.onSelectRef.current?.(drag.id)
    }
    canvas.style.cursor = 'move'
    refs.drawRef.current()
  }

  const onWheel = (ev: WheelEvent) => {
    ev.preventDefault()
    stopCameraFollow(refs)
    const rect = canvas.getBoundingClientRect()
    const mx = ev.clientX - rect.left
    const my = ev.clientY - rect.top
    const next = graphCanvasApplyZoom(refs.transformRef.current, mx, my, ev.deltaY)
    if (!next) return
    refs.transformRef.current = next
    refs.drawRef.current()
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
    refs.dragRef.current = {
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
}
