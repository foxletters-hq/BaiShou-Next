import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdFolder, MdSearch, MdHistory } from 'react-icons/md'
import type { WorkbenchSideView } from './useWorkbenchLayoutState'
import { WorkbenchFileExplorer } from './WorkbenchFileExplorer'
import { WorkbenchSearchView } from './WorkbenchSearchView'
import { WorkbenchGitView } from './WorkbenchGitView'
import styles from './WorkbenchSidePane.module.css'

export interface WorkbenchSidePaneProps {
  folderRoot: string | null
  activeView: WorkbenchSideView
  onViewChange: (view: WorkbenchSideView) => void
  onOpenFile: (relativePath: string) => void
  width: number
  changesCount?: number
}

export const WorkbenchSidePane: React.FC<WorkbenchSidePaneProps> = ({
  folderRoot,
  activeView,
  onViewChange,
  onOpenFile,
  width,
  changesCount = 0
}) => {
  const { t } = useTranslation()

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
          <MdFolder size={18} />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'search'}
          className={`${styles.viewTab} ${activeView === 'search' ? styles.viewTabActive : ''}`}
          title={t('workbench.search', '搜索')}
          onClick={() => onViewChange('search')}
        >
          <MdSearch size={18} />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeView === 'git'}
          className={`${styles.viewTab} ${activeView === 'git' ? styles.viewTabActive : ''}`}
          title={t('workbench.git', 'Git')}
          onClick={() => onViewChange('git')}
        >
          <MdHistory size={18} />
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
          <WorkbenchGitView changesCount={changesCount} />
        ) : null}
      </div>
    </aside>
  )
}
