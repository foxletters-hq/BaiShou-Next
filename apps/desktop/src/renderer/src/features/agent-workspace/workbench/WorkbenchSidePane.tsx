import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Folder, Search, GitBranch, Settings } from 'lucide-react'
import type { WorkbenchSideView } from './useWorkbenchLayoutState'
import { WorkbenchFileExplorer } from './WorkbenchFileExplorer'
import { WorkbenchSearchView } from './WorkbenchSearchView'
import { WorkbenchGitView } from './WorkbenchGitView'
import { useWorkbenchGitPanel } from './useWorkbenchGitPanel'
import { WorkbenchWorkspaceGateSheet } from './WorkbenchWorkspaceGateSheet'
import {
  locationToReturnPath,
  rememberSettingsReturnPath
} from '../../settings/settings-navigation.util'
import { prefetchSettingsEntry } from '../../../lib/prefetch-settings-entry'
import styles from './WorkbenchSidePane.module.css'

const ICON_SIZE = 18
const ICON_STROKE = 1.75

export interface WorkbenchSidePaneProps {
  folderRoot: string | null
  activeView: WorkbenchSideView
  onViewChange: (view: WorkbenchSideView) => void
  onOpenFile: (relativePath: string, options?: { line?: number; column?: number }) => void
  onOpenGitDiff?: (filePath: string, options?: { staged?: boolean; commitHash?: string }) => void
  onGitMetaChange?: (meta: { branch?: string; ahead: number; behind: number }) => void
  width: number
  changesCount?: number
  onGitChangesCountChange?: (count: number) => void
  onBackToHome: () => void
  workspaceId?: string | null
  workspaceName?: string | null
}

export const WorkbenchSidePane: React.FC<WorkbenchSidePaneProps> = ({
  folderRoot,
  activeView,
  onViewChange,
  onOpenFile,
  onOpenGitDiff,
  onGitMetaChange,
  width,
  changesCount = 0,
  onGitChangesCountChange,
  onBackToHome,
  workspaceId,
  workspaceName
}) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const gitPanelProps = useWorkbenchGitPanel(folderRoot)
  const [gateSettingsOpen, setGateSettingsOpen] = useState(false)

  useEffect(() => {
    setGateSettingsOpen(false)
  }, [workspaceId])

  const handleOpenSystemSettings = () => {
    rememberSettingsReturnPath(locationToReturnPath(location))
    navigate('/settings/general')
  }

  const handleOpenWorkbenchSettings = () => {
    if (!workspaceId) return
    setGateSettingsOpen(true)
  }

  return (
    <aside className={styles.pane} style={{ width }}>
      <div className={styles.viewTabs} role="tablist">
        <button
          type="button"
          className={styles.viewTab}
          title={t('workbench.back_to_home', '全部工作目录')}
          aria-label={t('workbench.back_to_home', '全部工作目录')}
          onClick={onBackToHome}
        >
          <ArrowLeft size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'files'}
          className={`${styles.viewTab} ${activeView === 'files' ? styles.viewTabActive : ''}`}
          title={t('workbench.files', '文件')}
          onClick={() => onViewChange('files')}
        >
          <Folder size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'search'}
          className={`${styles.viewTab} ${activeView === 'search' ? styles.viewTabActive : ''}`}
          title={t('workbench.search', '搜索')}
          onClick={() => onViewChange('search')}
        >
          <Search size={ICON_SIZE} strokeWidth={ICON_STROKE} />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'git'}
          className={`${styles.viewTab} ${activeView === 'git' ? styles.viewTabActive : ''}`}
          title={t('workbench.git', 'Git')}
          onClick={() => onViewChange('git')}
        >
          <GitBranch size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          {changesCount > 0 ? <span className={styles.badge}>{changesCount}</span> : null}
        </button>
      </div>

      <div className={styles.viewBody}>
        {activeView === 'files' ? (
          <WorkbenchFileExplorer folderRoot={folderRoot} onOpenFile={onOpenFile} />
        ) : null}
        {activeView === 'search' ? (
          <WorkbenchSearchView folderRoot={folderRoot} onOpenFile={onOpenFile} />
        ) : null}
        {activeView === 'git' ? (
          <WorkbenchGitView
            folderRoot={folderRoot}
            panelProps={gitPanelProps}
            onChangesCountChange={onGitChangesCountChange}
            onOpenGitDiff={onOpenGitDiff}
            onGitMetaChange={onGitMetaChange}
          />
        ) : null}
      </div>

      <div className={styles.footer}>
        <div className={styles.divider} />
        <div className={styles.fixedNav}>
          <button
            type="button"
            className={styles.navItem}
            disabled={!workspaceId}
            onClick={handleOpenWorkbenchSettings}
          >
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

      {workspaceId ? (
        <WorkbenchWorkspaceGateSheet
          open={gateSettingsOpen}
          workspaceId={workspaceId}
          workspaceName={workspaceName || t('workbench.settings', '工作台设置')}
          onClose={() => setGateSettingsOpen(false)}
        />
      ) : null}
    </aside>
  )
}
