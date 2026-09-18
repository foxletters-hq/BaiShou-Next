import { useRef, useState } from 'react'
import { usePanelResize } from '../agent-workspace/workbench/usePanelResize'
import type { GraphSideMode } from './graph-page.types'
import {
  GRAPH_SIDE_WIDTH_MAX,
  GRAPH_SIDE_WIDTH_MIN,
  loadGraphSideCollapsed,
  loadGraphSideWidth,
  saveGraphSideCollapsed,
  saveGraphSideWidth
} from './graph-page-side.util'

export function useGraphPageSideLayout() {
  const [sideWidth, setSideWidth] = useState(loadGraphSideWidth)
  const [sideCollapsed, setSideCollapsed] = useState(loadGraphSideCollapsed)
  const [sideMode, setSideMode] = useState<GraphSideMode>('organize')
  const sideWidthRef = useRef(sideWidth)
  sideWidthRef.current = sideWidth

  const setSideCollapsedPersist = (collapsed: boolean) => {
    setSideCollapsed(collapsed)
    saveGraphSideCollapsed(collapsed)
  }

  const openSide = (mode: GraphSideMode) => {
    setSideMode(mode)
    if (sideCollapsed) setSideCollapsedPersist(false)
  }

  const { onMouseDown: onSideResizeDown } = usePanelResize({
    getWidth: () => sideWidthRef.current,
    onResize: setSideWidth,
    onCommit: (w) => {
      saveGraphSideWidth(w)
    },
    min: GRAPH_SIDE_WIDTH_MIN,
    max: GRAPH_SIDE_WIDTH_MAX,
    invertDelta: true
  })

  return {
    sideWidth,
    sideCollapsed,
    sideMode,
    setSideMode,
    setSideCollapsedPersist,
    openSide,
    onSideResizeDown
  }
}
