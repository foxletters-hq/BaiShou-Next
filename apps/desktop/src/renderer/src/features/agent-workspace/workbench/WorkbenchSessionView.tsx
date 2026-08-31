import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Pencil, Pin, Search, Trash2 } from 'lucide-react'
import type { AgentWorkspaceEntry, AgentWorkspaceSessionListItem } from '@baishou/shared'
import { Input } from '@baishou/ui'
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
  pinned: 'workbench.sessions_group_pinned',
  today: 'workbench.sessions_group_today',
  yesterday: 'workbench.sessions_group_yesterday',
  previous7days: 'workbench.sessions_group_week',
  older: 'workbench.sessions_group_older'
}

function sessionGroupLabel(
  t: (key: string, fallback: string) => string,
  key: SessionTimeGroupKey
): string {
  switch (key) {
    case 'pinned':
      return t(GROUP_LABEL_KEYS.pinned, '已置顶')
    case 'today':
      return t(GROUP_LABEL_KEYS.today, '今天')
    case 'yesterday':
      return t(GROUP_LABEL_KEYS.yesterday, '昨天')
    case 'previous7days':
      return t(GROUP_LABEL_KEYS.previous7days, '过去 7 天')
    case 'older':
      return t(GROUP_LABEL_KEYS.older, '更早')
  }
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
  }, [defaultTitle, query, sessions, workspace])

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

  const handlePinSession = useCallback((sessionId: string, pinned: boolean) => {
    void (async () => {
      try {
        const pinSession = window.api?.agentWorkspace?.pinSession
        if (pinSession) {
          await pinSession(sessionId, !pinned)
        } else {
          await window.electron.ipcRenderer.invoke('agent:pin-session', sessionId, !pinned)
        }
        window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
      } catch (error) {
        console.error('[WorkbenchSessionView] pin session failed:', error)
      }
    })()
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
          <Input
            type="search"
            fieldSize="small"
            inputClassName={styles.searchInput}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('workbench.search_sessions', '搜索会话…')}
          />
        </div>
      </div>

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
              <h4 className={styles.groupTitle}>{sessionGroupLabel(t, group.key)}</h4>
              <ul className={styles.sessionList}>
                {group.sessions.map((session) => {
                  const isActive = activeSessionId === session.sessionId
                  const isEditing = editingId === session.sessionId
                  const title = sessionDisplayTitle(session, defaultTitle)

                  return (
                    <li key={session.sessionId} className={styles.sessionNode}>
                      {isEditing ? (
                        <div className={styles.editRow}>
                          <Input
                            fieldSize="small"
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
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${session.isPinned ? styles.iconBtnActive : ''}`}
                              title={
                                session.isPinned
                                  ? t('workbench.home_unpin_session', '取消置顶')
                                  : t('workbench.home_pin_session', '置顶对话')
                              }
                              onClick={() => handlePinSession(session.sessionId, Boolean(session.isPinned))}
                            >
                              <Pin
                                size={13}
                                strokeWidth={1.75}
                                fill={session.isPinned ? 'currentColor' : 'none'}
                              />
                            </button>
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
