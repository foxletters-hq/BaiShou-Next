import { useCallback, useRef } from 'react'

interface UsePanelResizeOptions {
  onResize: (nextWidth: number) => void
  onCommit?: (nextWidth: number) => void
  getWidth: () => number
  min: number
  max: number
  /** 向左拖增宽（右侧 Agent 面板） */
  invertDelta?: boolean
}

export function usePanelResize({
  onResize,
  onCommit,
  getWidth,
  min,
  max,
  invertDelta = false
}: UsePanelResizeOptions) {
  const startWidthRef = useRef(0)

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      const startX = event.clientX
      startWidthRef.current = getWidth()
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMove = (moveEvent: MouseEvent) => {
        const rawDelta = moveEvent.clientX - startX
        const delta = invertDelta ? -rawDelta : rawDelta
        const next = Math.min(max, Math.max(min, startWidthRef.current + delta))
        onResize(next)
      }

      const onUp = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        onCommit?.(getWidth())
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [getWidth, invertDelta, max, min, onCommit, onResize]
  )

  return { onMouseDown }
}
