import React from 'react'
import type { TFunction } from 'i18next'
import { withAppContentOverlay } from '@baishou/ui'
import styles from './AgentSessionRenameModal.module.css'

interface RenameTarget {
  id: string
  title: string
}

interface AgentSessionRenameModalProps {
  renameTarget: RenameTarget
  renameInputRef: React.RefObject<HTMLInputElement | null>
  t: TFunction
  onClose: () => void
  onTitleChange: (title: string) => void
  onCommit: () => void
}

export const AgentSessionRenameModal: React.FC<AgentSessionRenameModalProps> = ({
  renameTarget,
  renameInputRef,
  t,
  onClose,
  onTitleChange,
  onCommit
}) => (
  <div className={`${withAppContentOverlay()} ${styles.backdrop}`} onClick={onClose}>
    <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
      <div className={styles.title}>{t('agent.rename_session', '重命名对话')}</div>
      <input
        ref={renameInputRef}
        autoFocus
        className={styles.input}
        value={renameTarget.title}
        onChange={(e) => onTitleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit()
          if (e.key === 'Escape') onClose()
        }}
      />
      <div className={styles.actions}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          {t('common.cancel', '取消')}
        </button>
        <button type="button" className={styles.confirmBtn} onClick={onCommit}>
          {t('common.confirm', '确定')}
        </button>
      </div>
    </div>
  </div>
)
