import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Pencil, Search, Trash2 } from 'lucide-react'
import type { AgentWorkspaceEntry, AgentWorkspaceSessionListItem } from '@baishou/shared'
import { workspaceEntryMatchesFolder } from '../utils/workspace-display.util'
import { groupSessionsByTime, type SessionTimeGroupKey } from './workbenchSessionGroups'
import styles from './WorkbenchSessionView.module.css'

export interface WorkbenchSessionViewProps {
  workspace: AgentWorkspaceEntry | null
  sessions: AgentWorkspaceSessionListItem[]
  activeSessionId?: string
  loadingSessions?: boolean
  onSelectSession: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
  onRenameSession?: (sessionId: string, title: string) => void
}

const GROUP_LABEL_KEYS: Record<SessionTimeGroupKey, string> = {
  today: 'workbench.sessions_group_today',
  yesterday: 'workbench.sessions_group_yesterday',
  previous7days: 'workbench.sessions_group_week',
  older: 'workbench.sessions_group_older'
}

const GROUP_LABEL_FALLBACKS: Record<SessionTimeGroupKey, string> = {
  today: '今天',
  yesterday: '昨天',
  previous7days: '过去 7 天',
  older: '更早'
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

function sessionDisplayTitle(session: AgentWorkspaceSessionListItem, fallback: string): string {
  return session.title?.trim() || fallback
}

export const WorkbenchSessionView: React.FC<WorkbenchSessionViewProps> = ({
  workspace,
  sessions,
  activeSessionId,
  loadingSessions = false,
  onSelectSession,
  onDeleteSession,
  onRenameSession
}) => {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  const defaultTitle = t('agent.sessions.default_title', '新对话')

  const workspaceSessions = useMemo(() => {
    if (!workspace) return []
    const normalizedQuery = query.trim().toLowerCase()
    return sessions
      .filter((session) => workspaceEntryMatchesFolder(workspace, session.folderRoot))
      .filter((session) => {
        if (!normalizedQuery) return true
        const title = sessionDisplayTitle(session, defaultTitle).toLowerCase()
        return title.includes(normalizedQuery)
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [defaultTitle, query, sessions, workspace])

  const activeSession = useMemo(
    () => workspaceSessions.find((session) => session.sessionId === activeSessionId) ?? null,
    [activeSessionId, workspaceSessions]
  )

  const groupedSessions = useMemo(() => groupSessionsByTime(workspaceSessions), [workspaceSessions])

  const startEditing = useCallback(
    (session: AgentWorkspaceSessionListItem) => {
      if (!onRenameSession) return
      setEditingId(session.sessionId)
      setDraftTitle(sessionDisplayTitle(session, defaultTitle))
    },
    [defaultTitle, onRenameSession]
  )

  const cancelEditing = useCallback(() => {
    setEditingId(null)
    setDraftTitle('')
  }, [])

  const commitEditing = useCallback(
    (sessionId: string) => {
      const trimmed = draftTitle.trim()
      if (!trimmed || !onRenameSession) {
        cancelEditing()
        return
      }
      onRenameSession(sessionId, trimmed)
      cancelEditing()
    },
    [cancelEditing, draftTitle, onRenameSession]
  )

  if (!workspace) {
    return (
      <div className={styles.placeholder}>
        {t('agent_workspace.pick_workspace_hint', '请先选择或添加工作区')}
      </div>
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={14} strokeWidth={1.75} className={styles.searchIcon} aria-hidden />
          <input
            type="search"
            className={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('workbench.search_sessions', '搜索会话…')}
          />
        </div>
      </div>

      {activeSession ? (
        <div className={styles.currentBlock}>
          <span className={styles.currentLabel}>{t('workbench.current_session', '当前会话')}</span>
          <span className={styles.currentTitle}>
            {sessionDisplayTitle(activeSession, defaultTitle)}
          </span>
        </div>
      ) : null}

      <div className={styles.list}>
        {loadingSessions && workspaceSessions.length === 0 ? (
          <p className={styles.placeholder}>{t('common.loading', '加载中…')}</p>
        ) : workspaceSessions.length === 0 ? (
          <p className={styles.placeholder}>
            {query.trim()
              ? t('workbench.no_sessions_match', '没有匹配的会话')
              : t('agent_workspace.no_sessions', '暂无工作区会话')}
          </p>
        ) : (
          groupedSessions.map((group) => (
            <section key={group.key} className={styles.group}>
              <h4 className={styles.groupTitle}>
                {t(GROUP_LABEL_KEYS[group.key], GROUP_LABEL_FALLBACKS[group.key])}
              </h4>
              <ul className={styles.sessionList}>
                {group.sessions.map((session) => {
                  const isActive = activeSessionId === session.sessionId
                  const isEditing = editingId === session.sessionId
                  const title = sessionDisplayTitle(session, defaultTitle)

                  return (
                    <li key={session.sessionId} className={styles.sessionNode}>
                      {isEditing ? (
                        <div className={styles.editRow}>
                          <input
                            className={styles.editInput}
                            value={draftTitle}
                            autoFocus
                            onChange={(event) => setDraftTitle(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') commitEditing(session.sessionId)
                              if (event.key === 'Escape') cancelEditing()
                            }}
                          />
                          <button
                            type="button"
                            className={styles.iconBtn}
                            title={t('common.save', '保存')}
                            onClick={() => commitEditing(session.sessionId)}
                          >
                            <Check size={14} strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            title={t('common.cancel', '取消')}
                            onClick={cancelEditing}
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`${styles.sessionBtn} ${isActive ? styles.sessionBtnActive : ''}`}
                            onClick={() => onSelectSession(session.sessionId)}
                            onDoubleClick={() => startEditing(session)}
                          >
                            <span className={styles.sessionTitle}>{title}</span>
                            <span className={styles.sessionMeta}>
                              {session.updatedAt ? formatSessionTime(session.updatedAt) : ''}
                            </span>
                          </button>
                          <div className={styles.sessionActions}>
                            {onRenameSession ? (
                              <button
                                type="button"
                                className={styles.iconBtn}
                                title={t('workbench.rename_session', '重命名')}
                                onClick={() => startEditing(session)}
                              >
                                <Pencil size={13} strokeWidth={1.75} />
                              </button>
                            ) : null}
                            {onDeleteSession ? (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                                title={t('agent_workspace.delete_session', '删除会话')}
                                onClick={() => onDeleteSession(session.sessionId)}
                              >
                                <Trash2 size={13} strokeWidth={1.75} />
                              </button>
                            ) : null}
                          </div>
                        </>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
