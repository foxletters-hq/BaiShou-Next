import React, { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { MdChevronRight, MdExpandMore, MdInsertDriveFile, MdRefresh } from 'react-icons/md'
import { useWorkbenchFileTree, type FileTreeNode } from './useWorkbenchFileTree'
import styles from './WorkbenchFileExplorer.module.css'

export interface WorkbenchFileExplorerProps {
  folderRoot: string | null
  onOpenFile: (relativePath: string) => void
}

function TreeNode({
  node,
  depth,
  selectedPath,
  isExpanded,
  getChildren,
  onToggle,
  onSelect
}: {
  node: FileTreeNode
  depth: number
  selectedPath: string | null
  isExpanded: (path: string) => boolean
  getChildren: (path: string) => FileTreeNode[]
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}) {
  const expanded = node.isDirectory && isExpanded(node.relativePath)
  const children = expanded ? getChildren(node.relativePath) : []
  const isSelected = selectedPath === node.relativePath

  return (
    <>
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {node.isDirectory ? (
          <button
            type="button"
            className={styles.chevronBtn}
            onClick={() => onToggle(node.relativePath)}
            aria-expanded={expanded}
          >
            {expanded ? <MdExpandMore size={16} /> : <MdChevronRight size={16} />}
          </button>
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        <button
          type="button"
          className={styles.nameBtn}
          onClick={() => {
            if (node.isDirectory) {
              onToggle(node.relativePath)
            } else {
              onSelect(node.relativePath)
            }
          }}
        >
          {!node.isDirectory ? <MdInsertDriveFile size={14} className={styles.fileIcon} /> : null}
          <span className={styles.name}>{node.name}</span>
        </button>
      </div>
      {expanded
        ? children.map((child) => (
            <TreeNode
              key={child.relativePath}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              isExpanded={isExpanded}
              getChildren={getChildren}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </>
  )
}

export const WorkbenchFileExplorer: React.FC<WorkbenchFileExplorerProps> = ({
  folderRoot,
  onOpenFile
}) => {
  const { t } = useTranslation()
  const tree = useWorkbenchFileTree(folderRoot)

  const handleSelect = useCallback(
    (relativePath: string) => {
      tree.selectPath(relativePath)
      onOpenFile(relativePath)
    },
    [onOpenFile, tree]
  )

  if (!folderRoot) {
    return (
      <div className={styles.placeholder}>
        {t('agent_workspace.no_folder', '未选择文件夹')}
      </div>
    )
  }

  return (
    <div className={styles.explorer}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t('workbench.files', '文件')}</span>
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={() => void tree.refreshRoot()}
          title={t('common.refresh', '刷新')}
        >
          <MdRefresh size={16} />
        </button>
      </div>
      <div className={styles.tree}>
        {tree.loadingRoot ? (
          <p className={styles.placeholder}>{t('common.loading', '加载中…')}</p>
        ) : tree.rootError ? (
          <p className={styles.error}>{tree.rootError}</p>
        ) : tree.rootChildren.length === 0 ? (
          <p className={styles.placeholder}>{t('agent_workspace.empty_tree', '文件夹为空')}</p>
        ) : (
          tree.rootChildren.map((node) => (
            <TreeNode
              key={node.relativePath}
              node={node}
              depth={0}
              selectedPath={tree.selectedPath}
              isExpanded={tree.isExpanded}
              getChildren={tree.getChildren}
              onToggle={tree.toggleExpanded}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
