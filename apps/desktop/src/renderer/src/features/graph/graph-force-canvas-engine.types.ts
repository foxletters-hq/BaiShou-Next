import type { Simulation } from 'd3-force'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphAppearanceSettings, GraphForceSettings } from '@baishou/shared'
import type { GraphForceSimLink, GraphForceSimNode } from './graph-force-canvas.types'

export type GraphForceDragState = {
  id: string | null
  pan: boolean
  dragging: boolean
  pointerId: number | null
  lastX: number
  lastY: number
  startX: number
  startY: number
}

export type GraphForceCanvasEngineRefs = {
  canvasRef: RefObject<HTMLCanvasElement | null>
  simRef: MutableRefObject<Simulation<GraphForceSimNode, GraphForceSimLink> | null>
  nodesRef: MutableRefObject<GraphForceSimNode[]>
  linksRef: MutableRefObject<GraphForceSimLink[]>
  transformRef: MutableRefObject<{ x: number; y: number; k: number }>
  forceRef: MutableRefObject<GraphForceSettings>
  appearanceRef: MutableRefObject<GraphAppearanceSettings>
  dragRef: MutableRefObject<GraphForceDragState>
  highlightRef: MutableRefObject<Set<string> | undefined>
  focusRef: MutableRefObject<Set<string> | undefined>
  selectedRef: MutableRefObject<string | null | undefined>
  selectedIdsRef: MutableRefObject<Set<string> | undefined>
  highlightEdgeRef: MutableRefObject<Set<string> | undefined>
  locateIdsRef: MutableRefObject<string[] | undefined>
  onSelectRef: MutableRefObject<((id: string) => void) | undefined>
  onClearRef: MutableRefObject<(() => void) | undefined>
  drawRef: MutableRefObject<() => void>
  centerRafRef: MutableRefObject<number | null>
  locateSeqRef: MutableRefObject<number>
  pendingZoomRef: MutableRefObject<boolean>
  cameraAnimRef: MutableRefObject<boolean>
  followUntilRef: MutableRefObject<number>
  suppressCameraRef: MutableRefObject<boolean>
  interactingRef: MutableRefObject<boolean>
  kickFollowRef: MutableRefObject<() => void>
  easeCameraTowardSelectedRef: MutableRefObject<(opts?: { k?: number; alpha?: number }) => boolean>
  graphFpRef: MutableRefObject<string>
  degreeByIdRef: MutableRefObject<Map<string, number>>
}
