import React from 'react'
import { useTranslation } from 'react-i18next'
import { MessagesSquare, Plus } from 'lucide-react'
import styles from './WorkbenchAgentPanel.module.css'

export function WorkbenchAgentPanelHeader({
  headerTitle,
  hasWorkspace,
  sessionsViewActive,
  onNewSession,
  onToggleSessionsView
}: {
  headerTitle: string
  hasWorkspace: boolean
  sessionsViewActive: boolean
  onNewSession: () => void
  onToggleSessionsView?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={styles.header}>
      <span className={styles.headerTitle} title={headerTitle}>
        {headerTitle}
      </span>
      {hasWorkspace ? (
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.headerIconBtn}
            title={t('agent_workspace.new_session', '新建会话')}
            onClick={onNewSession}
          >
            <Plus size={16} strokeWidth={1.75} aria-hidden />
          </button>
          {onToggleSessionsView ? (
            <button
              type="button"
              className={`${styles.headerIconBtn} ${sessionsViewActive ? styles.headerIconBtnActive : ''}`}
              title={t('workbench.session_history', '历史会话')}
              aria-pressed={sessionsViewActive}
              onClick={onToggleSessionsView}
            >
              <MessagesSquare size={16} strokeWidth={1.75} aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
