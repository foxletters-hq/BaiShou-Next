import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { withAppContentOverlay } from '@baishou/ui'
import styles from './KnowledgePage.module.css'

export interface KnowledgeDialogProps {
  open: boolean
  onClose: () => void
  /** 忙碌时禁止点遮罩关闭 */
  closeDisabled?: boolean
  title?: React.ReactNode
  children: React.ReactNode
  /** 追加到面板上的 class */
  className?: string
  'aria-label'?: string
}

/**
 * 知识库弹窗：动画与图谱月份选择一致（AnimatePresence + spring），
 * 遮罩裁剪策略与侧边栏管理 / 内容区浮层一致（withAppContentOverlay）。
 */
export const KnowledgeDialog: React.FC<KnowledgeDialogProps> = ({
  open,
  onClose,
  closeDisabled,
  title,
  children,
  className,
  'aria-label': ariaLabel
}) => {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = React.useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || typeof document === 'undefined') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={overlayRef}
          className={withAppContentOverlay(styles.dialogBackdrop)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          onMouseDown={(e) => {
            if (closeDisabled) return
            if (e.target === overlayRef.current) onClose()
          }}
        >
          <motion.div
            className={[styles.dialog, className].filter(Boolean).join(' ')}
            role="dialog"
            aria-modal="true"
            aria-label={typeof ariaLabel === 'string' ? ariaLabel : undefined}
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {title ? <h2 className={styles.dialogTitle}>{title}</h2> : null}
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
