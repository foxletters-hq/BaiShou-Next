import { useCallback, useRef } from 'react'
import { nextGitSplitRatio } from './git-workbench-split.util'

export function useVerticalSplitResize(options: {
  getContainerHeight: () => number
  getRatio: () => number
  onResize: (ratio: number) => void
  onCommit?: (ratio: number) => void
}) {
  const { getContainerHeight, getRatio, onResize, onCommit } = options
  const startRatioRef = useRef(0)

  const onMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0) return
      event.preventDefault()
      const startY = event.clientY
      const height = getContainerHeight()
      startRatioRef.current = getRatio()
      document.body.style.cursor = 'row-resize'
      document.body.style.userSelect = 'none'

      const onMove = (moveEvent: MouseEvent) => {
        onResize(nextGitSplitRatio(startRatioRef.current, height, moveEvent.clientY - startY))
      }

      const onUp = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        onCommit?.(getRatio())
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [getContainerHeight, getRatio, onCommit, onResize]
  )

  return { onMouseDown }
}
