import React, { HTMLAttributes, useEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './Modal.module.css'

export interface ModalProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  closeOnOverlayClick?: boolean
  /** Stack above other overlays (e.g. ModelSwitcherPopup). Default 1000. */
  zIndex?: number
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  closeOnOverlayClick = false,
  zIndex = 1000,
  ...props
}) => {
  useEffect(() => {
    if (isOpen && typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden'
    } else if (typeof document !== 'undefined') {
      document.body.style.overflow = 'auto'
    }
    return () => {
      if (typeof document !== 'undefined') document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  if (!isOpen || typeof document === 'undefined') return null

  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!closeOnOverlayClick || e.target !== e.currentTarget) return
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }

  return createPortal(
    <div className={styles.overlay} style={{ zIndex }} onPointerDown={handleOverlayPointerDown}>
      <div
        className={`${styles.modal} ${className}`.trim()}
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
