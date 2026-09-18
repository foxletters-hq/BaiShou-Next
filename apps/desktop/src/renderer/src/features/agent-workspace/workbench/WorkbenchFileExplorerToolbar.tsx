import React from 'react'
import { useTranslation } from 'react-i18next'
import { FilePlus, FolderPlus, ListCollapse, ListTree, RefreshCw, Trash2 } from 'lucide-react'
import styles from './WorkbenchFileExplorer.module.css'

export interface WorkbenchFileExplorerToolbarProps {
  canToggleAllFolders: boolean
  canCollapseAllFolders: boolean
  hasSelectedNode: boolean
  onNewFile: () => void
  onNewFolder: () => void
  onRefresh: () => void
  onToggleAllFolders: () => void
  onDeleteSelected: () => void
}

export const WorkbenchFileExplorerToolbar: React.FC<WorkbenchFileExplorerToolbarProps> = ({
  canToggleAllFolders,
  canCollapseAllFolders,
  hasSelectedNode,
  onNewFile,
  onNewFolder,
  onRefresh,
  onToggleAllFolders,
  onDeleteSelected
}) => {
  const { t } = useTranslation()
  const toggleTitle = canCollapseAllFolders
    ? t('workbench.collapse_folders', '折叠全部文件夹')
    : t('workbench.expand_folders', '展开全部文件夹')

  return (
    <div className={styles.header}>
      <span className={styles.headerTitle}>{t('workbench.files', '文件')}</span>
      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onNewFile}
          title={t('workbench.new_file', '新建文件')}
        >
          <FilePlus size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onNewFolder}
          title={t('workbench.new_folder', '新建文件夹')}
        >
          <FolderPlus size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onRefresh}
          title={t('common.refresh', '刷新')}
        >
          <RefreshCw size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onToggleAllFolders}
          disabled={!canToggleAllFolders}
          title={toggleTitle}
          aria-label={toggleTitle}
        >
          {canCollapseAllFolders ? (
            <ListCollapse size={16} strokeWidth={1.75} />
          ) : (
            <ListTree size={16} strokeWidth={1.75} />
          )}
        </button>
        {hasSelectedNode ? (
          <button
            type="button"
            className={styles.actionBtn}
            onClick={onDeleteSelected}
            title={t('workbench.delete', '删除')}
          >
            <Trash2 size={15} strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
