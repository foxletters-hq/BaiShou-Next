import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdAdd, MdMoreVert } from 'react-icons/md'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import {
  getWorkspaceInitialLabel,
  resolveWorkspaceAvatarSrc
} from '../utils/workspace-display.util'
import styles from './WorkspaceIconRail.module.css'

export interface WorkspaceIconRailProps {
  workspaces: AgentWorkspaceEntry[]
  activeWorkspaceId?: string | null
  onSelectWorkspace: (workspaceId: string) => void
  onAddWorkspace: () => void
  onChangeAvatar: (workspaceId: string) => void
}

export const WorkspaceIconRail: React.FC<WorkspaceIconRailProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onAddWorkspace,
  onChangeAvatar
}) => {
  const { t } = useTranslation()
  const [menuWorkspaceId, setMenuWorkspaceId] = useState<string | null>(null)

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, workspaceId: string) => {
      event.preventDefault()
      setMenuWorkspaceId(workspaceId)
      onChangeAvatar(workspaceId)
      setMenuWorkspaceId(null)
    },
    [onChangeAvatar]
  )

  return (
    <aside className={styles.rail} aria-label={t('agent_workspace.workspaces_title', '工作区')}>
      <div className={styles.header}>
        <button
          type="button"
          className={styles.addBtn}
          title={t('agent_workspace.add_workspace', '添加工作区')}
          onClick={onAddWorkspace}
        >
          <MdAdd size={24} aria-hidden />
        </button>
      </div>

      <div className={styles.list}>
        {workspaces.map((workspace) => {
          const isActive = workspace.id === activeWorkspaceId
          const avatarSrc = resolveWorkspaceAvatarSrc(workspace.avatarPath)
          const initial = getWorkspaceInitialLabel(workspace.displayName)
          return (
            <button
              key={workspace.id}
              type="button"
              className={`${styles.iconBtn} ${isActive ? styles.iconBtnActive : ''}`}
              title={workspace.displayName}
              onClick={() => onSelectWorkspace(workspace.id)}
              onContextMenu={(event) => handleContextMenu(event, workspace.id)}
              aria-pressed={isActive}
              aria-busy={menuWorkspaceId === workspace.id}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt={workspace.displayName} />
              ) : (
                <span className={styles.initial}>{initial}</span>
              )}
            </button>
          )
        })}
      </div>

      {activeWorkspaceId ? (
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.menuBtn}
            title={t('agent_workspace.change_avatar', '更改图标')}
            onClick={() => onChangeAvatar(activeWorkspaceId)}
          >
            <MdMoreVert size={22} aria-hidden />
          </button>
        </div>
      ) : null}
    </aside>
  )
}
