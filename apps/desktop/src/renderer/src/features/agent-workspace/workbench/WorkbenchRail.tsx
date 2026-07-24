import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Settings } from 'lucide-react'
import {
  locationToReturnPath,
  rememberSettingsReturnPath
} from '../../settings/settings-navigation.util'
import { prefetchSettingsEntry } from '../../../lib/prefetch-settings-entry'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import { FolderIconSwitcher } from './FolderIconSwitcher'
import styles from './WorkbenchRail.module.css'

const ICON_SIZE = 20
const ICON_STROKE = 1.75

export interface WorkbenchRailProps {
  workspaces: AgentWorkspaceEntry[]
  activeWorkspaceId?: string | null
  onSelectWorkspace: (workspaceId: string) => void
  onOpenFolder: () => void
  onChangeAvatar?: (workspaceId: string) => void
}

export const WorkbenchRail: React.FC<WorkbenchRailProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenFolder,
  onChangeAvatar
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const isSettings = location.pathname.startsWith('/settings')

  return (
    <nav className={styles.rail} aria-label={t('nav.workbench', '工作台')}>
      <div className={styles.top}>
        <button
          type="button"
          className={`${styles.railBtn} ${isSettings ? styles.railBtnActive : ''}`}
          title={t('workbench.settings', '设置')}
          onMouseEnter={prefetchSettingsEntry}
          onFocus={prefetchSettingsEntry}
          onClick={() => {
            rememberSettingsReturnPath(locationToReturnPath(location))
            navigate('/settings/general')
          }}
        >
          <Settings size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </button>
      </div>
      <FolderIconSwitcher
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelectWorkspace={onSelectWorkspace}
        onOpenFolder={onOpenFolder}
        onChangeAvatar={onChangeAvatar}
      />
    </nav>
  )
}
