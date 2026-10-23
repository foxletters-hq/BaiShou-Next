import { useCallback, useEffect, useRef, useState } from 'react'
import { shouldAcceptWorkbenchAgentPanelDrag } from './workbench-agent-panel-drop.util'

export function useWorkbenchAgentPanelDrop(params: {
  enabled: boolean
  ingestDrop: (dataTransfer: DataTransfer) => void | Promise<void>
}) {
  const { enabled, ingestDrop } = params
  const [panelDropActive, setPanelDropActive] = useState(false)
  const depthRef = useRef(0)

  const handlePanelDragEnterCapture = useCallback(
    (event: React.DragEvent) => {
      if (!shouldAcceptWorkbenchAgentPanelDrag(event.dataTransfer, enabled)) return
      depthRef.current += 1
      setPanelDropActive(true)
    },
    [enabled]
  )

  const handlePanelDragOverCapture = useCallback(
    (event: React.DragEvent) => {
      if (!shouldAcceptWorkbenchAgentPanelDrag(event.dataTransfer, enabled)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [enabled]
  )

  const handlePanelDragLeaveCapture = useCallback(() => {
    depthRef.current = Math.max(0, depthRef.current - 1)
    if (depthRef.current === 0) setPanelDropActive(false)
  }, [])

  useEffect(() => {
    const clear = () => {
      depthRef.current = 0
      setPanelDropActive(false)
    }
    window.addEventListener('dragend', clear)
    return () => window.removeEventListener('dragend', clear)
  }, [])

  const handlePanelDropCapture = useCallback(
    (event: React.DragEvent) => {
      if (!shouldAcceptWorkbenchAgentPanelDrag(event.dataTransfer, enabled)) return
      event.preventDefault()
      event.stopPropagation()
      depthRef.current = 0
      setPanelDropActive(false)
      void ingestDrop(event.dataTransfer)
    },
    [enabled, ingestDrop]
  )

  return {
    panelDropActive,
    panelDropProps: {
      onDragEnterCapture: handlePanelDragEnterCapture,
      onDragOverCapture: handlePanelDragOverCapture,
      onDragLeaveCapture: handlePanelDragLeaveCapture,
      onDropCapture: handlePanelDropCapture
    }
  }
}
