import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Settings } from 'lucide-react'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import { FolderIconSwitcher } from './FolderIconSwitcher'
import { WorkbenchWorkspaceGateSheet } from './WorkbenchWorkspaceGateSheet'
import styles from './WorkbenchRail.module.css'

const ICON_SIZE = 20
const ICON_STROKE = 1.75

export interface WorkbenchRailProps {
  workspaces: AgentWorkspaceEntry[]
  activeWorkspaceId?: string | null
  onSelectWorkspace: (workspaceId: string) => void
  onOpenFolder: () => void
  onChangeAvatar?: (workspaceId: string) => void
  onBackToHome: () => void
}

export const WorkbenchRail: React.FC<WorkbenchRailProps> = ({
  workspaces,
  activeWorkspaceId,
  onSelectWorkspace,
  onOpenFolder,
  onChangeAvatar,
  onBackToHome
}) => {
  const { t } = useTranslation()
  const [settingsOpen, setSettingsOpen] = useState(false)

  const activeWorkspace = useMemo(
    () => workspaces.find((item) => item.id === activeWorkspaceId) ?? null,
    [workspaces, activeWorkspaceId]
  )

  useEffect(() => {
    setSettingsOpen(false)
  }, [activeWorkspaceId])

  return (
    <>
      <nav className={styles.rail} aria-label={t('nav.workbench', '工作台')}>
        <div className={styles.top}>
          <button
            type="button"
            className={styles.railBtn}
            title={t('workbench.back_to_home', '全部工作目录')}
            onClick={onBackToHome}
          >
            <ArrowLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          </button>
        </div>
        <FolderIconSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSelectWorkspace={onSelectWorkspace}
          onOpenFolder={onOpenFolder}
          onChangeAvatar={onChangeAvatar}
        />
        <div className={styles.bottom}>
          <button
            type="button"
            className={`${styles.railBtn} ${settingsOpen ? styles.railBtnActive : ''}`}
            title={t('workbench.settings', '工作台设置')}
            disabled={!activeWorkspace}
            aria-pressed={settingsOpen}
            onClick={() => {
              if (!activeWorkspace) return
              setSettingsOpen((prev) => !prev)
            }}
          >
            <Settings size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          </button>
        </div>
      </nav>
      {activeWorkspace ? (
        <WorkbenchWorkspaceGateSheet
          open={settingsOpen}
          workspaceId={activeWorkspace.id}
          workspaceName={activeWorkspace.displayName}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </>
  )
}
