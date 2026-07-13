import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { resolveAttachmentAbsolutePath } from '@baishou/shared'
import { ContextMenu, type ContextMenuItem } from '../ContextMenu'
import { useToast } from '../Toast/useToast'
import { DIARY_EDITOR_OVERLAY_Z } from '../../shared/diary-codemirror/editorOverlayZIndex'
import './ImagePreview.css'

type CopyAttachmentResult = { success: boolean; error?: string }

/** 解析为可供复制的本地路径；data URL 不含在此（避免 IPC 写文本） */
function resolveCopyFilePath(src: string): string | null {
  const trimmed = src.trim()
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return null
  if (trimmed.startsWith('local://') || trimmed.startsWith('file://')) {
    const abs = resolveAttachmentAbsolutePath(trimmed)
    return abs || null
  }
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith('/')) {
    return trimmed
  }
  return null
}

function getDiaryCopyApi(): {
  copyAttachment?: (p: string) => Promise<CopyAttachmentResult>
} | null {
  const w = window as Window & {
    api?: { diary?: { copyAttachment?: (p: string) => Promise<CopyAttachmentResult> } }
    electron?: { ipcRenderer?: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } }
  }
  if (w.api?.diary?.copyAttachment) return w.api.diary
  if (w.electron?.ipcRenderer?.invoke) {
    return {
      copyAttachment: (p: string) =>
        w.electron!.ipcRenderer!.invoke('diary:copy-attachment', p) as Promise<CopyAttachmentResult>
    }
  }
  return null
}

/** 渲染进程把 data URL 写成图片剪贴板（不走 IPC，避免把 base64 当文本） */
async function copyDataUrlAsImage(dataUrl: string): Promise<CopyAttachmentResult> {
  try {
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    const type = blob.type.startsWith('image/') ? blob.type : 'image/png'
    await navigator.clipboard.write([new ClipboardItem({ [type]: blob })])
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Copy failed' }
  }
}

/**
 * 优先用本地文件路径走主进程 writeImage；
 * 仅预览 data URL 时在渲染进程写图片，绝不把 base64 文本写入剪贴板。
 */
async function copyPreviewImage(src: string, copySource?: string): Promise<CopyAttachmentResult> {
  const diary = getDiaryCopyApi()
  const fileCandidates = [copySource, src]
    .map((s) => (s ? resolveCopyFilePath(s) : null))
    .filter((p): p is string => !!p)

  for (const filePath of fileCandidates) {
    if (!diary?.copyAttachment) break
    const res = await diary.copyAttachment(filePath)
    if (res?.success) return res
  }

  const dataUrl =
    (copySource?.startsWith('data:image/') ? copySource : null) ||
    (src.startsWith('data:image/') ? src : null)

  if (dataUrl) {
    const local = await copyDataUrlAsImage(dataUrl)
    if (local.success) return local
    // 渲染进程失败时再试主进程 createFromDataURL（仍不会 writeText）
    if (diary?.copyAttachment) {
      return diary.copyAttachment(dataUrl)
    }
    return local
  }

  return { success: false, error: 'No image to copy' }
}

interface ImagePreviewProps {
  src: string
  /** 复制用本地路径（优先于 src 的 data URL，避免剪贴板变成 base64 文本） */
  copySource?: string
  alt?: string
  className?: string
  style?: React.CSSProperties
  isOpen?: boolean
  onClose?: () => void
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  src,
  copySource,
  alt = '',
  className = '',
  style,
  isOpen: controlledOpen,
  onClose: controlledClose
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
    } catch (err: any) {
      toast.showError(err?.message || t('markdown.copy_image_failed', '复制失败'))
    }
  }, [src, copySource, t, toast])

  const previewContextMenuItems = useMemo<ContextMenuItem[]>(
    () => [
      {
        label: t('markdown.copy_image', '复制图片'),
        icon: <Copy size={14} />,
        onClick: () => {
          void handleCopyImage()
        }
      }
    ],
    [t, handleCopyImage]
  )

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
