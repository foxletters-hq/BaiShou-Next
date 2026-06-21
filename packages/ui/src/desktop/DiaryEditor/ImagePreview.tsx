import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './ImagePreview.css'

interface ImagePreviewProps {
  src: string
  alt?: string
  className?: string
  style?: React.CSSProperties
  isOpen?: boolean
  onClose?: () => void
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  src,
  alt = '',
  className = '',
  style,
  isOpen: controlledOpen,
  onClose: controlledClose
}) => {
  const { t } = useTranslation()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isPreviewOpen = isControlled ? controlledOpen : internalOpen
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [transformTransition, setTransformTransition] = useState(true)
  const dragStart = useRef({ x: 0, y: 0 })
  const positionStart = useRef({ x: 0, y: 0 })

  const resetView = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setTransformTransition(false)
    setRotation(0)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setTransformTransition(true))
    })
  }, [])

  const handleOpenPreview = useCallback(() => {
    if (isControlled) return
    setInternalOpen(true)
    resetView()
  }, [isControlled, resetView])

  const handleClosePreview = useCallback(() => {
    if (isControlled) {
      controlledClose?.()
    } else {
      setInternalOpen(false)
    }
  }, [isControlled, controlledClose])

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.25, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale((prev) => Math.max(prev - 0.25, 0.5))
  }, [])

  const handleRotate = useCallback(() => {
    // 累积角度，避免 270° → 0° 时 CSS 走最短路径逆时针回转
    setRotation((prev) => prev + 90)
  }, [])

  const handleResetZoom = useCallback(() => {
    resetView()
  }, [resetView])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      setIsDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY }
      positionStart.current = { ...position }
    },
    [position]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setPosition({
        x: positionStart.current.x + dx,
        y: positionStart.current.y + dy
      })
    },
    [isDragging]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((prev) => Math.max(0.5, Math.min(3, prev + delta)))
  }, [])

  useEffect(() => {
    if (isControlled && controlledOpen) {
      resetView()
    }
  }, [isControlled, controlledOpen, resetView, src])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClosePreview()
      }
    }

    if (isPreviewOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }

    return undefined
  }, [isPreviewOpen, handleClosePreview])

  return (
    <>
      {!isControlled && (
        <img
          src={src}
          alt={alt}
          className={`image-preview-trigger ${className}`}
          style={style}
          onClick={handleOpenPreview}
          draggable={false}
        />
      )}

      {isPreviewOpen && (
        <div className="image-preview-overlay" onClick={handleClosePreview}>
          <div
            className="image-preview-container"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <img
              src={src}
              alt={alt}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                cursor: isDragging ? 'grabbing' : 'grab',
                transition: transformTransition ? 'transform 0.12s ease-out' : 'none'
              }}
              draggable={false}
            />
          </div>

          <div className="image-preview-toolbar" onClick={(e) => e.stopPropagation()}>
            <div className="image-preview-controls">
              <button
                type="button"
                onClick={handleZoomIn}
                title={t('image_preview.zoom_in', 'Zoom in')}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="11" y1="8" x2="11" y2="14" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                title={t('image_preview.zoom_out', 'Zoom out')}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleRotate}
                title={t('image_preview.rotate', 'Rotate')}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 12a9 9 0 1 1-9-9" />
                  <polyline points="21 3 21 9 15 9" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                title={t('image_preview.reset', 'Reset')}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
              <span className="image-preview-controls-divider" aria-hidden="true" />
              <button
                type="button"
                className="image-preview-close-btn"
                onClick={handleClosePreview}
                title={t('common.close', 'Close')}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
