import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MdAdd } from 'react-icons/md'
import type { AgentWorkspaceEntry, AgentWorkspaceSessionListItem } from '@baishou/shared'
import { workspaceEntryMatchesFolder } from '../utils/workspace-display.util'
import styles from './WorkspaceSessionPanel.module.css'

export interface WorkspaceSessionPanelProps {
  workspace: AgentWorkspaceEntry | null
  sessions: AgentWorkspaceSessionListItem[]
  activeSessionId?: string
  loadingSessions?: boolean
  onNewSession: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
}

function formatSessionTime(updatedAt: string): string {
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const WorkspaceSessionPanel: React.FC<WorkspaceSessionPanelProps> = ({
  workspace,
  sessions,
  activeSessionId,
  loadingSessions = false,
  onNewSession,
  onSelectSession,
  onDeleteSession
}) => {
  const { t } = useTranslation()

  const workspaceSessions = useMemo(() => {
    if (!workspace) return []
    return sessions
      .filter((session) => workspaceEntryMatchesFolder(workspace, session.folderRoot))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [sessions, workspace])

  if (!workspace) {
    return null
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.workspaceName}>{workspace.displayName}</h2>
        <p className={styles.workspacePath} title={workspace.folderRoot}>
          {workspace.folderRoot}
        </p>
        <button type="button" className={styles.newSessionBtn} onClick={onNewSession}>
          <MdAdd size={18} aria-hidden />
          <span>{t('agent_workspace.new_session', '新建会话')}</span>
        </button>
      </div>

      <div className={styles.sessionList}>
        {loadingSessions && workspaceSessions.length === 0 ? (
          <p className={styles.placeholder}>{t('common.loading', '加载中…')}</p>
        ) : workspaceSessions.length === 0 ? (
          <p className={styles.placeholder}>
            {t('agent_workspace.no_sessions', '暂无工作区会话')}
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 4 }}>
            {workspaceSessions.map((session) => {
              const isActive = activeSessionId === session.sessionId
              return (
                <li key={session.sessionId} className={styles.sessionNode}>
                  <button
                    type="button"
                    className={`${styles.sessionBtn} ${isActive ? styles.sessionBtnActive : ''}`}
                    onClick={() => onSelectSession(session.sessionId)}
                  >
                    <span className={styles.sessionTitle}>{session.title}</span>
                    <span className={styles.sessionMeta}>
                      {session.updatedAt ? formatSessionTime(session.updatedAt) : ''}
                    </span>
                  </button>
                  {onDeleteSession ? (
                    <button
                      type="button"
                      className={styles.sessionDeleteBtn}
                      title={t('agent_workspace.delete_session', '删除会话')}
                      onClick={(event) => {
                        event.stopPropagation()
                        onDeleteSession(session.sessionId)
                      }}
                    >
                      ×
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}
