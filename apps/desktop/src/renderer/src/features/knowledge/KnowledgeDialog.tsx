import React from 'react'
import { Modal } from '@baishou/ui'
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

/** 知识库居中弹窗：外壳走共享 Modal（fade，裁到内容卡）。 */
export const KnowledgeDialog: React.FC<KnowledgeDialogProps> = ({
  open,
  onClose,
  closeDisabled,
  title,
  children,
  className,
  'aria-label': ariaLabel
}) => (
  <Modal
    isOpen={open}
    onClose={closeDisabled ? () => undefined : onClose}
    closeOnOverlayClick={!closeDisabled}
    title={title}
    animation="fade"
    className={[styles.dialog, className].filter(Boolean).join(' ')}
    zIndex={2000}
    aria-label={ariaLabel}
  >
    {children}
  </Modal>
)
