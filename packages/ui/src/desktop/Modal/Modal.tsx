import React, { HTMLAttributes, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { withAppContentOverlay } from '../overlay/appContentOverlay'
import styles from './Modal.module.css'

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  closeOnOverlayClick?: boolean
  /** Stack above other overlays (e.g. ModelSwitcherPopup). Default 1000. */
  zIndex?: number
  /** 自定义遮罩层样式类（如额外 padding） */
  overlayClassName?: string
  /**
   * Clip backdrop to the main content card under TitleBar (default true).
   * Set false for immersive full-window surfaces.
   */
  containToContentCard?: boolean
  /**
   * scale 会把文字先栅格化再拉伸，CJK 看起来像换了字体。
   * 确认框等短文案弹窗应使用 fade。
   */
  animation?: 'scale' | 'fade'
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  closeOnOverlayClick = false,
  zIndex = 1000,
  overlayClassName = '',
  containToContentCard = true,
  animation = 'scale',
  ...props
}) => {
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!closeOnOverlayClick || e.target !== e.currentTarget) return
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }

  const overlayClasses = withAppContentOverlay(
    `${styles.overlay} ${containToContentCard ? '' : styles.overlayFullWindow} ${overlayClassName}`.trim(),
    { fullWindow: !containToContentCard }
  )

  return createPortal(
    <div
      className={overlayClasses}
      style={{ zIndex }}
      onPointerDown={handleOverlayPointerDown}
    >
      <div
        className={`${styles.modal} ${animation === 'fade' ? styles.modalFade : ''} ${className}`.trim()}
        style={{ zIndex: zIndex + 1 }}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {title && <div className={styles.header}>{title}</div>}
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body
  )
}
