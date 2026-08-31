import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BookMarked,
  ChevronDown,
  Folder,
  Home,
  Pin,
  Plus,
  Settings,
  Sparkles,
  Trash2
} from 'lucide-react'
import type { AgentWorkspaceEntry, AgentWorkspaceSessionListItem } from '@baishou/shared'
import { useDialog } from '@baishou/ui'
import workbenchSidebarIcon from '../assets/workbench-sidebar-icon.jpg'
import {
  locationToReturnPath,
  rememberSettingsReturnPath
} from '../../../settings/settings-navigation.util'
import { prefetchSettingsEntry } from '../../../../lib/prefetch-settings-entry'
import {
  formatCompactRelativeTime,
  isWorkspacePinned,
  sortAgentWorkspaces,
  workspaceEntryMatchesFolder
} from '../../utils/workspace-display.util'
import {
  readSkipRemoveRecentConfirm,
  writeSkipRemoveRecentConfirm
} from '../../utils/workspace-dont-ask-again.util'
import { previewWorkspaceSessions } from '../workbenchSessionGroups'
import styles from './WorkbenchHomeSidebar.module.css'

export type WorkbenchHomeNavId = 'home' | 'knowledge' | 'skills' | 'projects' | null

const RECENT_LIMIT = 10
const SESSION_PREVIEW_LIMIT = 8
const EXPANDED_STORAGE_KEY = 'baishou:workbench-home-recent-expanded'

function readExpandedPreference(): boolean {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY)
    if (raw === null) return true
    return raw === '1'
  } catch {
    return true
  }
}

function writeExpandedPreference(expanded: boolean): void {
  try {
    localStorage.setItem(EXPANDED_STORAGE_KEY, expanded ? '1' : '0')
  } catch {
    /* ignore */
  }
}

export interface WorkbenchHomeSidebarProps {
  activeNav?: WorkbenchHomeNavId
  onNewProject: () => void
  onOpenHome: () => void
  onOpenKnowledge: () => void
  onOpenSkills: () => void
  onOpenProjects: () => void
  onOpenSettings: () => void
  creating?: boolean
  /** 最近项目列表（未排序也可，侧栏内会按置顶与最近活跃排序） */
  recentWorkspaces?: AgentWorkspaceEntry[]
  lastActiveWorkspaceId?: string | null
  sessions?: AgentWorkspaceSessionListItem[]
  onOpenWorkspace?: (workspaceId: string) => void
  onOpenSession?: (sessionId: string, workspaceId: string) => void
  onDeleteSession?: (sessionId: string) => void
  /** 由父组件提供，避免侧栏再开一份 useAgentWorkspaces 导致状态不同步 */
  onRemoveWorkspace: (workspaceId: string) => Promise<boolean>
  onTogglePinWorkspace: (workspaceId: string, pinned: boolean) => Promise<unknown>
  onTogglePinSession?: (sessionId: string, pinned: boolean) => Promise<unknown>
}

export const WorkbenchHomeSidebar: React.FC<WorkbenchHomeSidebarProps> = ({
  activeNav = null,
  onNewProject,
  onOpenHome,
  onOpenKnowledge,
  onOpenSkills,
  onOpenProjects: _onOpenProjects,
  onOpenSettings,
  creating,
  recentWorkspaces = [],
  lastActiveWorkspaceId = null,
  sessions = [],
  onOpenWorkspace,
  onOpenSession,
  onDeleteSession,
  onRemoveWorkspace,
  onTogglePinWorkspace,
  onTogglePinSession
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const dialog = useDialog()
  const [recentExpanded, setRecentExpanded] = useState(readExpandedPreference)
  const [removing, setRemoving] = useState(false)
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<string>>(() =>
    lastActiveWorkspaceId ? new Set([lastActiveWorkspaceId]) : new Set()
  )
  const seededExpandRef = useRef(Boolean(lastActiveWorkspaceId))

  useEffect(() => {
    if (seededExpandRef.current || !lastActiveWorkspaceId) return
    seededExpandRef.current = true
    setExpandedWorkspaceIds(new Set([lastActiveWorkspaceId]))
  }, [lastActiveWorkspaceId])

  const handleOpenSystemSettings = useCallback(() => {
    rememberSettingsReturnPath(locationToReturnPath(location))
    navigate('/settings/general')
  }, [location, navigate])

  const recent = useMemo(
    () => sortAgentWorkspaces(recentWorkspaces, lastActiveWorkspaceId).slice(0, RECENT_LIMIT),
    [lastActiveWorkspaceId, recentWorkspaces]
  )

  const sessionsByWorkspaceId = useMemo(() => {
    const map = new Map<string, AgentWorkspaceSessionListItem[]>()
    for (const ws of recent) {
      const list = sessions.filter((session) =>
        workspaceEntryMatchesFolder(ws, session.folderRoot)
      )
      map.set(ws.id, list)
    }
    return map
  }, [recent, sessions])

  const toggleRecent = useCallback(() => {
    setRecentExpanded((prev) => {
      const next = !prev
      writeExpandedPreference(next)
      return next
    })
  }, [])

  const toggleWorkspaceExpand = useCallback((workspaceId: string) => {
    setExpandedWorkspaceIds((prev) => {
      const next = new Set(prev)
      if (next.has(workspaceId)) next.delete(workspaceId)
      else next.add(workspaceId)
      return next
    })
  }, [])

  const projectLabel = useCallback(
    (ws: AgentWorkspaceEntry) =>
      ws.kind === 'scratch' ? t('workbench.home_scratch_name', '稿纸') : ws.displayName,
    [t]
  )

  const performRemove = useCallback(
    async (ws: AgentWorkspaceEntry) => {
      setRemoving(true)
      try {
        const ok = await onRemoveWorkspace(ws.id)
        if (!ok) {
          await dialog.alert(
            t('workbench.home_remove_workspace_failed', '移除工作目录失败'),
            t('workbench.home_remove_workspace', '移除工作目录')
          )
        }
      } catch (error) {
        console.error('[WorkbenchHomeSidebar] remove workspace failed:', error)
        await dialog.alert(
          error instanceof Error
            ? error.message
            : t('workbench.home_remove_workspace_failed', '移除工作目录失败'),
          t('workbench.home_remove_workspace', '移除工作目录')
        )
      } finally {
        setRemoving(false)
      }
    },
    [dialog, onRemoveWorkspace, t]
  )

  const handleRemoveClick = useCallback(
    (e: React.MouseEvent, ws: AgentWorkspaceEntry) => {
      e.stopPropagation()
      e.preventDefault()
      if (removing) return
      if (readSkipRemoveRecentConfirm()) {
        void performRemove(ws)
        return
      }
      void dialog
        .confirmWithDontAskAgain(
          t(
            'workbench.home_remove_workspace_confirm',
            '将「{{name}}」从工作目录列表中移除？磁盘上的文件不会被删除。',
            { name: projectLabel(ws) }
          ),
          t('workbench.home_remove_workspace', '移除工作目录'),
          t('workbench.home_remove_dont_ask_again', '不再提示')
        )
        .then((result) => {
          if (!result.confirmed) return
          if (result.dontAskAgain) writeSkipRemoveRecentConfirm()
          void performRemove(ws)
        })
    },
    [dialog, performRemove, projectLabel, removing, t]
  )

  const handlePinClick = useCallback(
    (e: React.MouseEvent, ws: AgentWorkspaceEntry) => {
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.blur()
      const nextPinned = !isWorkspacePinned(ws)
      if (nextPinned) {
        setExpandedWorkspaceIds((prev) => {
          const next = new Set(prev)
          next.add(ws.id)
          return next
        })
      }
      void onTogglePinWorkspace(ws.id, nextPinned)
    },
    [onTogglePinWorkspace]
  )

  const handleDeleteSessionClick = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation()
      e.preventDefault()
      onDeleteSession?.(sessionId)
    },
    [onDeleteSession]
  )

  const handlePinSessionClick = useCallback(
    (e: React.MouseEvent, sessionId: string, pinned: boolean) => {
      e.stopPropagation()
      e.preventDefault()
      e.currentTarget.blur()
      void (async () => {
        try {
          if (onTogglePinSession) {
            await onTogglePinSession(sessionId, !pinned)
            return
          }
          const pinSession = window.api?.agentWorkspace?.pinSession
          if (pinSession) {
            await pinSession(sessionId, !pinned)
          } else {
            await window.electron.ipcRenderer.invoke('agent:pin-session', sessionId, !pinned)
          }
          window.dispatchEvent(new CustomEvent('baishou:workspace-sessions-changed'))
        } catch (error) {
          console.error('[WorkbenchHomeSidebar] pin session failed:', error)
        }
      })()
    },
    [onTogglePinSession]
  )

  return (
    <aside className={styles.sidebar} aria-label={t('nav.workbench', '工作台')}>
      {/* 与日记侧栏 .brandRow 同结构：Logo + 标题垂直居中 */}
      <div className={styles.brandRow}>
        <div className={styles.logoBox}>
          <img src={workbenchSidebarIcon} alt="" className={styles.brandLogo} />
        </div>
        <div className={styles.brandText}>
          <div className={styles.brandName}>{t('nav.workbench', '工作台')}</div>
          <div className={styles.brandSlogan}>
            {t('workbench.home_brand_subtitle', '与伙伴一起创作')}
          </div>
        </div>
      </div>

      <div className={styles.menuContainer}>
        <div className={styles.newProjectWrapper}>
          <button
            type="button"
            className={styles.newProjectBtn}
            onClick={onNewProject}
            disabled={creating}
          >
            <Plus size={18} />
            <span>{t('workbench.home_new_project', '新建项目')}</span>
          </button>
        </div>

        <nav className={styles.navList} aria-label={t('workbench.home_nav', '工作台导航')}>
          <button
            type="button"
            className={`${styles.navItem} ${activeNav === 'home' ? styles.selected : ''}`}
            onClick={onOpenHome}
          >
            <span className={styles.navLead} aria-hidden />
            <span className={styles.navIcon} aria-hidden>
              <Home size={18} />
            </span>
            <span className={styles.navLabel}>{t('workbench.home_nav_home', '首页')}</span>
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeNav === 'knowledge' ? styles.selected : ''}`}
            onClick={onOpenKnowledge}
          >
            {/* 对应日记侧栏隐藏的拖拽手柄占位，保证文字起点一致 */}
            <span className={styles.navLead} aria-hidden />
            <span className={styles.navIcon} aria-hidden>
              <BookMarked size={18} />
            </span>
            <span className={styles.navLabel}>{t('workbench.home_knowledge', '知识库')}</span>
          </button>
          <button
            type="button"
            className={`${styles.navItem} ${activeNav === 'skills' ? styles.selected : ''}`}
            onClick={onOpenSkills}
          >
            <span className={styles.navLead} aria-hidden />
            <span className={styles.navIcon} aria-hidden>
              <Sparkles size={18} />
            </span>
            <span className={styles.navLabel}>{t('workbench.home_skills', '技能')}</span>
          </button>

          <div className={styles.recentSection}>
            <button
              type="button"
              className={`${styles.recentHeader} ${activeNav === 'projects' ? styles.selected : ''}`}
              onClick={toggleRecent}
              aria-expanded={recentExpanded}
              title={t('workbench.home_recent_projects', '最近项目')}
            >
              <span className={styles.recentHeaderLabel}>
                {t('workbench.home_recent_projects', '最近项目')}
                {recent.length > 0 ? ` (${recent.length})` : ''}
              </span>
              <ChevronDown
                size={16}
                className={`${styles.recentChevron} ${recentExpanded ? styles.recentChevronOpen : ''}`}
                aria-hidden
              />
            </button>

            {recentExpanded ? (
              recent.length === 0 ? (
                <p className={styles.recentEmpty}>
                  {t('workbench.home_empty_dirs_title', '还没有工作目录')}
                </p>
              ) : (
                <ul
                  className={styles.recentList}
                  aria-label={t('workbench.home_recent_projects', '最近项目')}
                >
                  {recent.map((ws) => {
                    const pinned = isWorkspacePinned(ws)
                    const isExpanded = expandedWorkspaceIds.has(ws.id)
                    const workspaceSessions = sessionsByWorkspaceId.get(ws.id) ?? []
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
                            onClick={() => toggleWorkspaceExpand(ws.id)}
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
                              onClick={(e) => handlePinClick(e, ws)}
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
                              onClick={(e) => handleRemoveClick(e, ws)}
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
                                        {formatCompactRelativeTime(session.updatedAt)}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      className={`${styles.sessionActionBtn} ${sessionPinned ? styles.sessionActionBtnActive : ''}`}
                                      onClick={(e) =>
                                        handlePinSessionClick(e, session.sessionId, sessionPinned)
                                      }
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
                                        onClick={(e) =>
                                          handleDeleteSessionClick(e, session.sessionId)
                                        }
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
            ) : null}
          </div>
        </nav>

        <div className={styles.dividerWrapper}>
          <div className={styles.divider} />
        </div>

        <div className={styles.fixedNav}>
          <button type="button" className={styles.navItem} onClick={onOpenSettings}>
            <span className={styles.navIcon} aria-hidden>
              <Settings size={18} />
            </span>
            <span className={styles.navLabel}>{t('workbench.settings', '工作台设置')}</span>
          </button>
          <button
            type="button"
            className={styles.navItem}
            onMouseEnter={prefetchSettingsEntry}
            onFocus={prefetchSettingsEntry}
            onClick={handleOpenSystemSettings}
          >
            <span className={styles.navIcon} aria-hidden>
              <Settings size={18} />
            </span>
            <span className={styles.navLabel}>{t('settings.title', '系统设置')}</span>
          </button>
        </div>
      </div>
    </aside>
  )
}
