import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdAdd, MdChevronLeft, MdChevronRight, MdExpandMore, MdFolder, MdMenu } from 'react-icons/md'
import type { AgentWorkspaceSessionListItem } from '@baishou/shared'
import styles from './WorkspaceSessionSidebar.module.css'

export interface FolderGroup {
  folderRoot: string
  folderDisplayName: string
  updatedAt: string
  sessions: AgentWorkspaceSessionListItem[]
}

export interface WorkspaceSessionSidebarProps {
  folderRoot: string | null
  activeSessionId?: string
  sessions: AgentWorkspaceSessionListItem[]
  loadingSessions?: boolean
  collapsed: boolean
  onToggleCollapsed: () => void
  onPickFolder: () => void
  onFolderFocus: (folderRoot: string) => void
  onSelectSession: (sessionId: string) => void
  onNewSession: (folderRoot: string) => void
  onDeleteSession?: (sessionId: string) => void
  className?: string
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

function buildFolderGroups(
  sessions: AgentWorkspaceSessionListItem[],
  folderRoot: string | null,
  folderDisplayName?: string
): FolderGroup[] {
  const map = new Map<string, FolderGroup>()

  for (const session of sessions) {
    let group = map.get(session.folderRoot)
    if (!group) {
      group = {
        folderRoot: session.folderRoot,
        folderDisplayName: session.folderDisplayName,
        updatedAt: session.updatedAt,
        sessions: []
      }
      map.set(session.folderRoot, group)
    }
    group.sessions.push(session)
    if (session.updatedAt > group.updatedAt) {
      group.updatedAt = session.updatedAt
    }
  }

  if (folderRoot && !map.has(folderRoot)) {
    const name =
      folderDisplayName ??
      folderRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() ??
      folderRoot
    map.set(folderRoot, {
      folderRoot,
      folderDisplayName: name,
      updatedAt: new Date().toISOString(),
      sessions: []
    })
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      sessions: [...group.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export const WorkspaceSessionSidebar: React.FC<WorkspaceSessionSidebarProps> = ({
  folderRoot,
  activeSessionId,
  sessions,
  loadingSessions = false,
  collapsed,
  onToggleCollapsed,
  onPickFolder,
  onFolderFocus,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  className
}) => {
  const { t } = useTranslation()
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())

  const folderDisplayName = useMemo(() => {
    if (!folderRoot) return undefined
    const match = sessions.find((s) => s.folderRoot === folderRoot)
    return (
      match?.folderDisplayName ??
      folderRoot.replace(/\\/g, '/').split('/').filter(Boolean).pop() ??
      folderRoot
    )
  }, [folderRoot, sessions])

  const folderGroups = useMemo(
    () => buildFolderGroups(sessions, folderRoot, folderDisplayName),
    [sessions, folderRoot, folderDisplayName]
  )

  useEffect(() => {
    if (!activeSessionId) return
    const active = sessions.find((s) => s.sessionId === activeSessionId)
    if (!active) return
    setExpandedFolders((prev) => {
      if (prev.has(active.folderRoot)) return prev
      const next = new Set(prev)
      next.add(active.folderRoot)
      return next
    })
  }, [activeSessionId, sessions])

  useEffect(() => {
    if (!folderRoot) return
    setExpandedFolders((prev) => {
      if (prev.has(folderRoot)) return prev
      const next = new Set(prev)
      next.add(folderRoot)
      return next
    })
  }, [folderRoot])

  const toggleFolder = (root: string) => {
    onFolderFocus(root)
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(root)) {
        next.delete(root)
      } else {
        next.add(root)
      }
      return next
    })
  }

  if (collapsed) {
    return (
      <button
        type="button"
        className={`${styles.collapsedRail} ${className ?? ''}`}
        onClick={onToggleCollapsed}
        title={t('agent_workspace.expand_sidebar', '展开侧栏')}
      >
        <MdMenu size={20} aria-hidden />
      </button>
    )
  }

  return (
    <aside className={`${styles.sidebar} ${className ?? ''}`}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t('nav.agent_workspace', 'Agent')}</span>
        <button
          type="button"
          className={styles.collapseBtn}
          onClick={onToggleCollapsed}
          title={t('agent_workspace.collapse_sidebar', '收起侧栏')}
        >
          <MdChevronLeft size={20} />
        </button>
      </div>

      <div className={styles.toolbar}>
        <button type="button" className={styles.addFolderBtn} onClick={onPickFolder}>
          <MdAdd size={18} />
          <span>{t('agent_workspace.open_folder', '打开文件夹')}</span>
        </button>
      </div>

      <div className={styles.treePane}>
        {loadingSessions && folderGroups.length === 0 ? (
          <p className={styles.placeholder}>{t('common.loading', '加载中…')}</p>
        ) : folderGroups.length === 0 ? (
          <p className={styles.placeholder}>{t('agent_workspace.no_folder', '暂无文件夹，点击上方打开')}</p>
        ) : (
          <ul className={styles.folderTree}>
            {folderGroups.map((group) => {
              const isExpanded = expandedFolders.has(group.folderRoot)
              const isFocused = folderRoot === group.folderRoot
              return (
                <li key={group.folderRoot} className={styles.folderNode}>
                  <button
                    type="button"
                    className={`${styles.folderRow} ${isFocused ? styles.folderRowFocused : ''}`}
                    onClick={() => toggleFolder(group.folderRoot)}
                    title={group.folderRoot}
                  >
                    <span className={styles.folderChevron} data-expanded={isExpanded ? 'true' : 'false'}>
                      {isExpanded ? <MdExpandMore size={18} /> : <MdChevronRight size={18} />}
                    </span>
                    <span className={styles.folderIcon} aria-hidden>
                      <MdFolder size={18} />
                    </span>
                    <span className={styles.folderName}>{group.folderDisplayName}</span>
                    <span className={styles.folderCount}>{group.sessions.length}</span>
                  </button>

                  {isExpanded ? (
                    <ul className={styles.sessionTree}>
                      {group.sessions.length === 0 ? (
                        <li className={styles.sessionEmpty}>
                          {t('agent_workspace.no_sessions_in_folder', '暂无对话')}
                        </li>
                      ) : (
                        group.sessions.map((session) => {
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
                        })
                      )}
                      <li>
                        <button
                          type="button"
                          className={styles.newSessionBtn}
                          onClick={() => onNewSession(group.folderRoot)}
                        >
                          <MdAdd size={16} />
                          <span>{t('agent_workspace.new_session', '新对话')}</span>
                        </button>
                      </li>
                    </ul>
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
