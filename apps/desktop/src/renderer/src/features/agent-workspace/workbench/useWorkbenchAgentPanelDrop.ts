import { useCallback, useEffect, useRef, useState } from 'react'
import { shouldAcceptWorkbenchAgentPanelDrag } from './workbench-agent-panel-drop.util'

export function useWorkbenchAgentPanelDrop(params: {
  enabled: boolean
  ingestDrop: (dataTransfer: DataTransfer) => void | Promise<void>
}) {
  const [panelDropActive, setPanelDropActive] = useState(false)
  const depthRef = useRef(0)

  const handlePanelDragEnterCapture = useCallback(
    (event: React.DragEvent) => {
      if (!shouldAcceptWorkbenchAgentPanelDrag(event.dataTransfer, params.enabled)) return
      depthRef.current += 1
      setPanelDropActive(true)
    },
    [params.enabled]
  )

  const handlePanelDragOverCapture = useCallback(
    (event: React.DragEvent) => {
      if (!shouldAcceptWorkbenchAgentPanelDrag(event.dataTransfer, params.enabled)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    },
    [params.enabled]
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
      if (!shouldAcceptWorkbenchAgentPanelDrag(event.dataTransfer, params.enabled)) return
      event.preventDefault()
      event.stopPropagation()
      depthRef.current = 0
      setPanelDropActive(false)
      void params.ingestDrop(event.dataTransfer)
    },
    [params.enabled, params.ingestDrop]
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
