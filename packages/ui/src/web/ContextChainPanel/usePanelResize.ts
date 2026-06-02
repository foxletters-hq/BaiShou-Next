import React from 'react'

const MIN_WIDTH = 420
const MAX_WIDTH_RATIO = 0.88
const DEFAULT_WIDTH_RATIO = 0.6
const STORAGE_KEY = 'baishou.context-chain.panel-width'

function clampWidth(width: number) {
  const max = Math.floor(window.innerWidth * MAX_WIDTH_RATIO)
  return Math.min(Math.max(width, MIN_WIDTH), max)
}

function readInitialWidth(): number {
  if (typeof window === 'undefined') {
    return 780
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = Number.parseInt(stored, 10)
      if (!Number.isNaN(parsed) && parsed >= MIN_WIDTH) {
        return clampWidth(parsed)
      }
    }
  } catch {
    // ignore quota / private mode
  }

  return clampWidth(Math.floor(window.innerWidth * DEFAULT_WIDTH_RATIO))
}

export function usePanelResize() {
  const [width, setWidth] = React.useState(readInitialWidth)
  const widthRef = React.useRef(width)

  React.useEffect(() => {
    widthRef.current = width
  }, [width])

  const onResizeStart = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = widthRef.current

    const onMove = (ev: MouseEvent) => {
      const next = clampWidth(startWidth + (startX - ev.clientX))
      setWidth(next)
    }

    const onUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      try {
        localStorage.setItem(STORAGE_KEY, String(widthRef.current))
      } catch {
        // ignore
      }
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return { width, onResizeStart }
}
