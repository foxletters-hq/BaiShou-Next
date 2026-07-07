import React from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, Search, GitBranch } from 'lucide-react'
import type { WorkbenchSideView } from './useWorkbenchLayoutState'
import { WorkbenchFileExplorer } from './WorkbenchFileExplorer'
import { WorkbenchSearchView } from './WorkbenchSearchView'
import { WorkbenchGitView } from './WorkbenchGitView'
import { useWorkbenchGitPanel } from './useWorkbenchGitPanel'
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
  onGitChangesCountChange
}) => {
  const { t } = useTranslation()
  const gitPanelProps = useWorkbenchGitPanel(folderRoot)

  return (
    <aside className={styles.pane} style={{ width }}>
      <div className={styles.viewTabs} role="tablist">
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
    </aside>
  )
}
