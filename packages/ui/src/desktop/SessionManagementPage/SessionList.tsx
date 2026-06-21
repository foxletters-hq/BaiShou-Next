import React from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import type { SessionInfo } from './session-management.types'
import { formatSessionDate } from './session-management.utils'
import styles from './SessionManagementPage.module.css'

interface SessionListProps {
  sessions: SessionInfo[]
  isMultiSelect: boolean
  selectedIds: Set<string>
  onSessionTap: (session: SessionInfo) => void
  onToggleSelect: (id: string) => void
  onPinToggle: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
}

export const SessionList: React.FC<SessionListProps> = ({
  sessions,
  isMultiSelect,
  selectedIds,
  onSessionTap,
  onToggleSelect,
  onPinToggle,
  onDeleteSession
}) => {
  const { t } = useTranslation()

  if (sessions.length === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>🕳️</span>
        <span className={styles.emptyText}>{t('agent.sessions.empty', '暂无会话记录...')}</span>
      </div>
    )
  }

  return (
    <div className={styles.sessionList}>
      {sessions.map((session) => (
        <div
          key={session.id}
          className={`${styles.sessionCard} ${
            selectedIds.has(session.id) ? styles.sessionCardSelected : ''
          }`}
          onClick={() => (isMultiSelect ? onToggleSelect(session.id) : onSessionTap(session))}
        >
          {isMultiSelect && (
            <input
              type="checkbox"
              className={styles.sessionCheckbox}
              checked={selectedIds.has(session.id)}
              onChange={() => onToggleSelect(session.id)}
              onClick={(e) => e.stopPropagation()}
            />
          )}

          <div className={styles.sessionInfo}>
            <div className={styles.sessionTitleRow}>
              <span className={styles.sessionTitle}>
                {session.title || t('agent.chat.new_chat_label', '新对话')}
              </span>
              {session.isPinned && <span className={styles.sessionPinBadge}>📌</span>}
            </div>
            <div className={styles.sessionMeta}>
              <span>
                {session.assistantEmoji} {session.assistantName}
              </span>
              <span className={styles.sessionMetaDot} />
              <span>
                {session.messageCount} {t('common.count_items').replace('$count', '')}
              </span>
              <span className={styles.sessionMetaDot} />
              <span>{formatSessionDate(session.updatedAt, t)}</span>
            </div>
          </div>

          {!isMultiSelect && (
            <div className={styles.sessionActions}>
              <button
                className={styles.sessionActionBtn}
                title={
                  session.isPinned
                    ? t('agent.sessions.unpin', '取消置顶')
                    : t('agent.sessions.pin', '置顶')
                }
                onClick={(e) => {
                  e.stopPropagation()
                  onPinToggle(session.id)
                }}
              >
                {session.isPinned ? '📌' : '📍'}
              </button>
              <button
                className={`${styles.sessionActionBtn} ${styles.sessionActionBtnDanger}`}
                title={t('common.delete', '删除')}
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteSession(session.id)
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
