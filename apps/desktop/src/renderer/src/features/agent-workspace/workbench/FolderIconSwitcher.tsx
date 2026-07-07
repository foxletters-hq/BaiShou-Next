import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import {
  getWorkspaceInitialLabel,
  resolveWorkspaceAvatarSrc
} from '../utils/workspace-display.util'
import styles from './FolderIconSwitcher.module.css'

const ICON_SIZE = 18
const ICON_STROKE = 2

export interface FolderIconSwitcherProps {
  workspaces: AgentWorkspaceEntry[]
  activeWorkspaceId?: string | null
  onSelectWorkspace: (workspaceId: string) => void
  onOpenFolder: () => void
  onChangeAvatar?: (workspaceId: string) => void
}

export const FolderIconSwitcher: React.FC<FolderIconSwitcherProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenFolder,
  onChangeAvatar
}) => {
  const { t } = useTranslation()

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, workspaceId: string) => {
      if (!onChangeAvatar) return
      event.preventDefault()
      onChangeAvatar(workspaceId)
    },
    [onChangeAvatar]
  )

  return (
    <div className={styles.root} aria-label={t('workbench.folders_title', '已打开的文件夹')}>
      {workspaces.map((workspace) => {
        const isActive = workspace.id === activeWorkspaceId
        const avatarSrc = resolveWorkspaceAvatarSrc(workspace.avatarPath)
        const initial = getWorkspaceInitialLabel(workspace.displayName)
        return (
          <button
            key={workspace.id}
            type="button"
            className={`${styles.folderBtn} ${isActive ? styles.folderBtnActive : ''}`}
            title={workspace.displayName || workspace.folderRoot}
            onClick={() => onSelectWorkspace(workspace.id)}
            onContextMenu={(event) => handleContextMenu(event, workspace.id)}
            aria-pressed={isActive}
          >
            {avatarSrc ? (
              <img src={avatarSrc} alt={workspace.displayName} />
            ) : (
              <span className={styles.initial} aria-hidden>
                {initial}
              </span>
            )}
          </button>
        )
      })}
      <button
        type="button"
        className={styles.addBtn}
        title={t('agent_workspace.open_folder', '打开文件夹')}
        onClick={onOpenFolder}
      >
        <Plus size={ICON_SIZE} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
    </div>
  )
}
