import { useEffect, useRef, useState } from 'react'

interface UseVerticalDragResizeOptions {
  initialHeight: number
  minHeight: number
  maxHeight: number
}

export function useVerticalDragResize({
  initialHeight,
  minHeight,
  maxHeight
}: UseVerticalDragResizeOptions) {
  const [height, setHeight] = useState(initialHeight)
  const heightRef = useRef(height)
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(initialHeight)
  const boundsRef = useRef({ minHeight, maxHeight })

  heightRef.current = height
  boundsRef.current = { minHeight, maxHeight }

  const onResizeMouseDown = (event: React.MouseEvent) => {
    event.preventDefault()
    draggingRef.current = true
    startYRef.current = event.clientY
    startHeightRef.current = heightRef.current

    const onMove = (moveEvent: MouseEvent) => {
      if (!draggingRef.current) return
      const { minHeight: min, maxHeight: max } = boundsRef.current
      const next = Math.min(
        max,
        Math.max(min, startHeightRef.current + moveEvent.clientY - startYRef.current)
      )
      setHeight(next)
    }

    const onUp = () => {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  useEffect(
    () => () => {
      draggingRef.current = false
    },
    []
  )

  return { height, onResizeMouseDown }
}
