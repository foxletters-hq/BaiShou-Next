import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Copy, Download } from 'lucide-react'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { useToast } from '../Toast/useToast'
import { DIARY_EDITOR_OVERLAY_Z } from '../../shared/diary-codemirror/editorOverlayZIndex'
import { copyPreviewImage, savePreviewImage } from './image-preview.util'
import './ImagePreview.css'

interface ImagePreviewProps {
  src: string
  /** 复制用本地路径（优先于 src 的 data URL，避免剪贴板变成 base64 文本） */
  copySource?: string
  alt?: string
  title?: string
  className?: string
  style?: React.CSSProperties
  isOpen?: boolean
  onClose?: () => void
  /** 另存为时的建议文件名 */
  downloadFileName?: string
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  src,
  copySource,
  alt = '',
  title,
  className = '',
  style,
  isOpen: controlledOpen,
  onClose: controlledClose,
  downloadFileName
}) => {
  const { t } = useTranslation()
  const toast = useToast()
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
  const positionRef = useRef(position)
  const overlayRef = useRef<HTMLDivElement>(null)
  const didDragRef = useRef(false)

  positionRef.current = position

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

  const handleOverlayClick = useCallback(() => {
    if (didDragRef.current) {
      didDragRef.current = false
      return
    }
    handleClosePreview()
  }, [handleClosePreview])

  const handleZoomIn = useCallback(() => {
    setTransformTransition(false)
    setScale((prev) => Math.min(prev + 0.25, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setTransformTransition(false)
    setScale((prev) => Math.max(prev - 0.25, 0.25))
  }, [])

  const handleRotate = useCallback(() => {
    // 累积角度，避免 270° → 0° 时 CSS 走最短路径逆时针回转
    setRotation((prev) => prev + 90)
  }, [])

  const handleResetZoom = useCallback(() => {
    resetView()
  }, [resetView])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    didDragRef.current = false
    setIsDragging(true)
    setTransformTransition(false)
    dragStart.current = { x: e.clientX, y: e.clientY }
    positionStart.current = { ...positionRef.current }
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const delta = e.deltaY > 0 ? -0.12 : 0.12
    setTransformTransition(false)
    setScale((prev) => Math.max(0.25, Math.min(5, prev + delta)))
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didDragRef.current = true
      }
      setPosition({
        x: positionStart.current.x + dx,
        y: positionStart.current.y + dy
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  useEffect(() => {
    if (!isPreviewOpen) return

    const overlay = overlayRef.current
    if (!overlay) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.12 : 0.12
      setTransformTransition(false)
      setScale((prev) => Math.max(0.25, Math.min(5, prev + delta)))
    }

    overlay.addEventListener('wheel', onWheel, { passive: false })
    return () => overlay.removeEventListener('wheel', onWheel)
  }, [isPreviewOpen])

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

  const handleCopyImage = useCallback(async () => {
    try {
      const res = await copyPreviewImage(src, copySource)
      if (res?.success) {
        toast.showSuccess(t('markdown.copy_image_success', '图片已复制到剪贴板'))
      } else {
        toast.showError(res?.error || t('markdown.copy_image_failed', '复制失败'))
      }
    } catch (err) {
      toast.showError(
        err instanceof Error ? err.message : t('markdown.copy_image_failed', '复制失败')
      )
    }
  }, [src, copySource, t, toast])

  const handleSaveImage = useCallback(async () => {
    try {
      const res = await savePreviewImage(src, { alt, fileName: downloadFileName })
      if (res.canceled) return
      if (res.success) {
        toast.showSuccess(t('image_preview.save_success', '图片已保存'))
      } else {
        toast.showError(res.error || t('image_preview.save_failed', '保存失败'))
      }
    } catch (err) {
      toast.showError(
        err instanceof Error ? err.message : t('image_preview.save_failed', '保存失败')
      )
    }
  }, [src, alt, downloadFileName, t, toast])

  const previewContextMenuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        label: t('markdown.copy_image', '复制图片'),
        icon: <Copy size={14} />,
        onClick: () => {
          void handleCopyImage()
        }
      },
      {
        label: t('image_preview.save', '保存图片'),
        icon: <Download size={14} />,
        onClick: () => {
          void handleSaveImage()
        }
      }
    ],
    [t, handleCopyImage, handleSaveImage]
  )

  return (
    <>
      {!isControlled && (
        <img
          src={src}
          alt={alt}
          title={title}
          className={`image-preview-trigger ${className}`}
          style={style}
          onClick={handleOpenPreview}
          draggable={false}
        />
      )}

      {isPreviewOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={overlayRef}
            className="image-preview-overlay"
            onClick={handleOverlayClick}
            onMouseUp={handleMouseUp}
          >
            <div className="image-preview-stage" onClick={handleOverlayClick}>
              <ContextMenu
                items={previewContextMenuItems}
                backdropZIndex={DIARY_EDITOR_OVERLAY_Z.imagePreviewMenuBackdrop}
                menuZIndex={DIARY_EDITOR_OVERLAY_Z.imagePreviewMenu}
              >
                <img
                  src={src}
                  alt={alt}
                  className="image-preview-stage-img"
                  style={{
                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    transition: transformTransition ? 'transform 0.12s ease-out' : 'none'
                  }}
                  draggable={false}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={handleMouseDown}
                  onWheel={handleWheel}
                />
              </ContextMenu>
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
                <button
                  type="button"
                  onClick={() => void handleSaveImage()}
                  title={t('image_preview.save', '保存图片')}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
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
          </div>,
          document.body
        )}
    </>
  )
}
