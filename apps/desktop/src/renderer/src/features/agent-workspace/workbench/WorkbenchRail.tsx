import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpen, LayoutPanelLeft, Settings } from 'lucide-react'
import { resolveDiaryHomePath } from '../../../components/Sidebar/sidebar-preferences'
import { SETTINGS_HUB_PREFIX } from '../../settings/settings-route.util'
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

  const isWorkbench = location.pathname.startsWith('/agent-workspace')
  const isDiary =
    !location.pathname.startsWith('/chat') &&
    !location.pathname.startsWith('/agent') &&
    !location.pathname.startsWith('/agent-workspace') &&
    !location.pathname.startsWith('/settings')
  const isSettings = location.pathname.startsWith('/settings')

  return (
    <nav className={styles.rail} aria-label={t('nav.workbench', '工作台')}>
      <div className={styles.top}>
        <button
          type="button"
          className={`${styles.railBtn} ${isDiary ? styles.railBtnActive : ''}`}
          title={t('workbench.diary', '日记')}
          onClick={() => navigate(resolveDiaryHomePath())}
        >
          <BookOpen size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </button>
        <button
          type="button"
          className={`${styles.railBtn} ${isWorkbench ? styles.railBtnActive : ''}`}
          title={t('nav.workbench', '工作台')}
          onClick={() => navigate('/agent-workspace')}
        >
          <LayoutPanelLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </button>
        <button
          type="button"
          className={`${styles.railBtn} ${isSettings ? styles.railBtnActive : ''}`}
          title={t('workbench.settings', '设置')}
          onClick={() => navigate(`${SETTINGS_HUB_PREFIX}/general`)}
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
