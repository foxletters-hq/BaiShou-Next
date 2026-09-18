import React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Folder, Pin, Trash2 } from 'lucide-react'
import type { AgentWorkspaceEntry, AgentWorkspaceSessionListItem } from '@baishou/shared'
import {
  formatCompactRelativeTime,
  isWorkspacePinned,
  workspaceEntryMatchesFolder
} from '../../utils/workspace-display.util'
import { previewWorkspaceSessions } from '../workbenchSessionGroups'
import styles from './WorkbenchHomeSidebar.module.css'

const SESSION_PREVIEW_LIMIT = 8

export interface WorkbenchHomeRecentTreeProps {
  recent: AgentWorkspaceEntry[]
  sessions: AgentWorkspaceSessionListItem[]
  expandedWorkspaceIds: Set<string>
  removing: boolean
  projectLabel: (ws: AgentWorkspaceEntry) => string
  onToggleWorkspaceExpand: (workspaceId: string) => void
  onOpenWorkspace?: (workspaceId: string) => void
  onOpenSession?: (sessionId: string, workspaceId: string) => void
  onPinWorkspace: (event: React.MouseEvent<HTMLButtonElement>, ws: AgentWorkspaceEntry) => void
  onRemoveWorkspace: (event: React.MouseEvent, ws: AgentWorkspaceEntry) => void
  onPinSession: (
    event: React.MouseEvent<HTMLButtonElement>,
    sessionId: string,
    pinned: boolean
  ) => void
  onDeleteSession?: (event: React.MouseEvent, sessionId: string) => void
}

export const WorkbenchHomeRecentTree: React.FC<WorkbenchHomeRecentTreeProps> = ({
  recent,
  sessions,
  expandedWorkspaceIds,
  removing,
  projectLabel,
  onToggleWorkspaceExpand,
  onOpenWorkspace,
  onOpenSession,
  onPinWorkspace,
  onRemoveWorkspace,
  onPinSession,
  onDeleteSession
}) => {
  const { t, i18n } = useTranslation()

  if (recent.length === 0) {
    return (
      <p className={styles.recentEmpty}>{t('workbench.home_empty_dirs_title', '还没有工作目录')}</p>
    )
  }

  return (
    <ul className={styles.recentList} aria-label={t('workbench.home_recent_projects', '最近项目')}>
      {recent.map((ws) => {
        const pinned = isWorkspacePinned(ws)
        const isExpanded = expandedWorkspaceIds.has(ws.id)
        const workspaceSessions = sessions.filter((session) =>
          workspaceEntryMatchesFolder(ws, session.folderRoot)
        )
        const { preview: previewSessions, hasMore } = previewWorkspaceSessions(
          workspaceSessions,
          SESSION_PREVIEW_LIMIT
        )
        return (
          <li key={ws.id} className={styles.recentTreeItem}>
            <div
              className={`${styles.recentItem} ${pinned ? styles.recentItemPinned : ''} ${isExpanded ? styles.recentItemExpanded : ''}`}
              title={ws.folderRoot}
            >
              <button
                type="button"
                className={styles.recentOpen}
                onClick={() => onToggleWorkspaceExpand(ws.id)}
                aria-expanded={isExpanded}
              >
                <ChevronDown
                  size={14}
                  className={`${styles.projectChevron} ${isExpanded ? styles.projectChevronOpen : ''}`}
                  aria-hidden
                />
                <Folder size={14} className={styles.projectFolderIcon} aria-hidden />
                {pinned ? (
                  <Pin
                    size={12}
                    className={styles.recentPinBadge}
                    fill="currentColor"
                    aria-hidden
                  />
                ) : null}
                <span className={styles.recentName}>{projectLabel(ws)}</span>
              </button>
              <div className={styles.recentActions}>
                <button
                  type="button"
                  className={`${styles.recentActionBtn} ${pinned ? styles.recentActionBtnActive : ''}`}
                  onClick={(e) => onPinWorkspace(e, ws)}
                  title={
                    pinned
                      ? t('workbench.home_unpin_project', '取消置顶')
                      : t('workbench.home_pin_project', '置顶')
                  }
                  aria-label={
                    pinned
                      ? t('workbench.home_unpin_project', '取消置顶')
                      : t('workbench.home_pin_project', '置顶')
                  }
                >
                  <Pin size={13} fill={pinned ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  className={styles.recentActionBtn}
                  onClick={(e) => onRemoveWorkspace(e, ws)}
                  disabled={removing}
                  title={t('workbench.home_remove_recent', '从列表中移除')}
                  aria-label={t('workbench.home_remove_recent', '从列表中移除')}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {isExpanded ? (
              <ul
                className={styles.sessionList}
                aria-label={t('workbench.home_recent_sessions', '最近对话')}
              >
                {previewSessions.length === 0 ? (
                  <li className={styles.sessionEmpty}>
                    {t('workbench.home_no_sessions', '暂无对话')}
                  </li>
                ) : (
                  previewSessions.map((session) => {
                    const sessionPinned = Boolean(session.isPinned)
                    return (
                      <li key={session.sessionId}>
                        <div
                          className={`${styles.sessionItem} ${sessionPinned ? styles.sessionItemPinned : ''}`}
                        >
                          <button
                            type="button"
                            className={styles.sessionOpen}
                            onClick={() => onOpenSession?.(session.sessionId, ws.id)}
                            title={session.title || t('workbench.untitled_session', '未命名会话')}
                          >
                            {sessionPinned ? (
                              <Pin
                                size={11}
                                className={styles.sessionPinBadge}
                                fill="currentColor"
                                aria-hidden
                              />
                            ) : null}
                            <span className={styles.sessionTitle}>
                              {session.title?.trim() ||
                                t('workbench.untitled_session', '未命名会话')}
                            </span>
                            <span className={styles.sessionTime}>
                              {formatCompactRelativeTime(session.updatedAt, {
                                t,
                                locale: i18n.language
                              })}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.sessionActionBtn} ${sessionPinned ? styles.sessionActionBtnActive : ''}`}
                            onClick={(e) => onPinSession(e, session.sessionId, sessionPinned)}
                            title={
                              sessionPinned
                                ? t('workbench.home_unpin_session', '取消置顶')
                                : t('workbench.home_pin_session', '置顶对话')
                            }
                            aria-label={
                              sessionPinned
                                ? t('workbench.home_unpin_session', '取消置顶')
                                : t('workbench.home_pin_session', '置顶对话')
                            }
                          >
                            <Pin size={12} fill={sessionPinned ? 'currentColor' : 'none'} />
                          </button>
                          {onDeleteSession ? (
                            <button
                              type="button"
                              className={styles.sessionActionBtn}
                              onClick={(e) => onDeleteSession(e, session.sessionId)}
                              title={t('agent_workspace.delete_session', '删除会话')}
                              aria-label={t('agent_workspace.delete_session', '删除会话')}
                            >
                              <Trash2 size={12} />
                            </button>
                          ) : null}
                        </div>
                      </li>
                    )
                  })
                )}
                {hasMore ? (
                  <li>
                    <button
                      type="button"
                      className={styles.sessionMore}
                      onClick={() => onOpenWorkspace?.(ws.id)}
                    >
                      {t('workbench.home_more_sessions', '更多')}
                    </button>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
