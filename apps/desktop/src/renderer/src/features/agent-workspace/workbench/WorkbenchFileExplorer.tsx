import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  ChevronDown,
  File,
  FilePlus,
  FolderPlus,
  Pencil,
  RefreshCw,
  Trash2
} from 'lucide-react'
import { useDialog, toast } from '@baishou/ui'
import { useWorkbenchFileTree, type FileTreeNode } from './useWorkbenchFileTree'
import { joinRelativePath, parentRelativePath } from './workbench-path.util'
import { suggestUniqueEntryName } from './workbench-inline-name.util'
import {
  buildFileExplorerMenuItems,
  WorkbenchFileExplorerContextMenu,
  useCloseOnScroll,
  type FileExplorerContextMenuState
} from './WorkbenchFileExplorerContextMenu'
import {
  InlineTreeNameRow,
  type InlineTreeEditState
} from './WorkbenchFileExplorerInlineEdit'
import styles from './WorkbenchFileExplorer.module.css'

export interface WorkbenchFileExplorerProps {
  folderRoot: string | null
  onOpenFile: (relativePath: string) => void
}

function findNodeInTree(
  nodes: FileTreeNode[],
  relativePath: string,
  getChildren: (path: string) => FileTreeNode[]
): FileTreeNode | undefined {
  for (const node of nodes) {
    if (node.relativePath === relativePath) return node
    if (node.isDirectory) {
      const nested = findNodeInTree(getChildren(node.relativePath), relativePath, getChildren)
      if (nested) return nested
    }
  }
  return undefined
}

function toAbsolutePath(folderRoot: string, relativePath?: string): string {
  const base = folderRoot.replace(/[/\\]+$/, '')
  if (!relativePath) return base
  return `${base}/${relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/')}`
}

function TreeNode({
  node,
  depth,
  selectedPath,
  isExpanded,
  getChildren,
  onToggle,
  onSelect,
  onContextMenu,
  inlineEdit,
  onCommitInline,
  onCancelInline
}: {
  node: FileTreeNode
  depth: number
  selectedPath: string | null
  isExpanded: (path: string) => boolean
  getChildren: (path: string) => FileTreeNode[]
  onToggle: (path: string) => void
  onSelect: (relativePath: string) => void
  onContextMenu: (event: React.MouseEvent, node: FileTreeNode) => void
  inlineEdit: InlineTreeEditState | null
  onCommitInline: (name: string) => void
  onCancelInline: () => void
}) {
  const expanded = node.isDirectory && isExpanded(node.relativePath)
  const children = expanded ? getChildren(node.relativePath) : []
  const isSelected = selectedPath === node.relativePath
  const isRenaming =
    inlineEdit?.mode === 'rename' && inlineEdit.relativePath === node.relativePath
  const pendingCreate =
    inlineEdit?.mode === 'create' && inlineEdit.parentDir === node.relativePath

  return (
    <>
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''} ${isRenaming ? styles.rowEditing : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onContextMenu={(event) => onContextMenu(event, node)}
      >
        {node.isDirectory ? (
          <button
            type="button"
            className={styles.chevronBtn}
            onClick={() => onToggle(node.relativePath)}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown size={16} strokeWidth={1.75} /> : <ChevronRight size={16} strokeWidth={1.75} />}
          </button>
        ) : (
          <span className={styles.chevronSpacer} />
        )}
        {isRenaming ? (
          <InlineTreeNameRow
            depth={depth}
            isDirectory={node.isDirectory}
            initialName={inlineEdit.initialName}
            existingNames={getChildren(parentRelativePath(node.relativePath)).map((child) => child.name)}
            ignoreName={node.name}
            onCommit={onCommitInline}
            onCancel={onCancelInline}
            embedded
          />
        ) : (
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
            {!node.isDirectory ? <File size={14} strokeWidth={1.75} className={styles.fileIcon} /> : null}
            <span className={styles.name}>{node.name}</span>
          </button>
        )}
      </div>
      {expanded ? (
        <>
          {children.map((child) => (
            <TreeNode
              key={child.relativePath}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              isExpanded={isExpanded}
              getChildren={getChildren}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              inlineEdit={inlineEdit}
              onCommitInline={onCommitInline}
              onCancelInline={onCancelInline}
            />
          ))}
          {pendingCreate ? (
            <InlineTreeNameRow
              depth={depth + 1}
              isDirectory={inlineEdit.kind === 'folder'}
              initialName={inlineEdit.initialName}
              existingNames={children.map((child) => child.name)}
              onCommit={onCommitInline}
              onCancel={onCancelInline}
            />
          ) : null}
        </>
      ) : null}
    </>
  )
}

export const WorkbenchFileExplorer: React.FC<WorkbenchFileExplorerProps> = ({
  folderRoot,
  onOpenFile
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const tree = useWorkbenchFileTree(folderRoot)
  const [contextMenu, setContextMenu] = useState<FileExplorerContextMenuState | null>(null)
  const [inlineEdit, setInlineEdit] = useState<InlineTreeEditState | null>(null)

  const closeContextMenu = useCallback(() => setContextMenu(null), [])
  useCloseOnScroll(closeContextMenu, Boolean(contextMenu))

  const resolveSelectedNode = useCallback((): FileTreeNode | null => {
    if (!tree.selectedPath) return null
    return (
      findNodeInTree(tree.rootChildren, tree.selectedPath, tree.getChildren) ?? {
        relativePath: tree.selectedPath,
        name: tree.selectedPath.split('/').pop() ?? tree.selectedPath,
        isDirectory: false
      }
    )
  }, [tree])

  const getParentDir = useCallback(() => {
    const selected = resolveSelectedNode()
    if (!selected) return ''
    return selected.isDirectory
      ? selected.relativePath
      : parentRelativePath(selected.relativePath)
  }, [resolveSelectedNode])

  const handleSelect = useCallback(
    (relativePath: string) => {
      tree.selectPath(relativePath)
      onOpenFile(relativePath)
    },
    [onOpenFile, tree]
  )

  const startCreate = useCallback(
    async (kind: 'file' | 'folder', parentDir = getParentDir()) => {
      if (!folderRoot) return
      if (parentDir) {
        tree.ensureExpanded(parentDir)
      }
      const siblings = await tree.loadDirectory(parentDir)
      const names = siblings.map((entry) => entry.name)
      const folderDefault = t('workbench.new_folder_default', '新建文件夹')
      setInlineEdit({
        mode: 'create',
        parentDir,
        kind,
        initialName:
          kind === 'file'
            ? suggestUniqueEntryName(names, 'untitled.md', false)
            : suggestUniqueEntryName(names, folderDefault, true)
      })
    },
    [folderRoot, getParentDir, t, tree]
  )

  const startRename = useCallback((node: FileTreeNode) => {
    setInlineEdit({
      mode: 'rename',
      relativePath: node.relativePath,
      isDirectory: node.isDirectory,
      initialName: node.name
    })
  }, [])

  const cancelInlineEdit = useCallback(() => {
    setInlineEdit(null)
  }, [])

  const commitInlineEdit = useCallback(
    async (name: string) => {
      if (!inlineEdit || !folderRoot) {
        setInlineEdit(null)
        return
      }

      const snapshot = inlineEdit
      setInlineEdit(null)

      try {
        if (snapshot.mode === 'create') {
          const relativePath = joinRelativePath(snapshot.parentDir, name)
          if (snapshot.kind === 'file') {
            const created = await window.api.agentWorkspace.createFile(folderRoot, relativePath, '')
            await tree.refreshPath(snapshot.parentDir)
            tree.selectPath(created.relativePath)
            onOpenFile(created.relativePath)
          } else {
            const created = await window.api.agentWorkspace.createDirectory(folderRoot, relativePath)
            if (snapshot.parentDir) tree.ensureExpanded(snapshot.parentDir)
            tree.ensureExpanded(created.relativePath)
            await tree.refreshPath(snapshot.parentDir)
            tree.selectPath(created.relativePath)
          }
          return
        }

        if (name === snapshot.initialName) return

        const result = await window.api.agentWorkspace.renameEntry(
          folderRoot,
          snapshot.relativePath,
          name
        )
        const parentDir = parentRelativePath(snapshot.relativePath)
        await tree.refreshPath(parentDir)
        tree.selectPath(result.relativePath)
        if (!snapshot.isDirectory) {
          onOpenFile(result.relativePath)
        }
      } catch (error) {
        toast.showError(error instanceof Error ? error.message : t('common.error', '操作失败'))
        setInlineEdit(snapshot)
      }
    },
    [folderRoot, inlineEdit, onOpenFile, t, tree]
  )

  const handleNewFile = useCallback(
    (parentDir = getParentDir()) => {
      void startCreate('file', parentDir)
    },
    [getParentDir, startCreate]
  )

  const handleNewFolder = useCallback(
    (parentDir = getParentDir()) => {
      void startCreate('folder', parentDir)
    },
    [getParentDir, startCreate]
  )

  const handleRename = useCallback(
    (node: FileTreeNode) => {
      startRename(node)
    },
    [startRename]
  )

  const handleDelete = useCallback(
    async (node: FileTreeNode) => {
      if (!folderRoot) return
      const confirmed = await dialog.confirm(
        `${t('workbench.delete_confirm', '确定删除？此操作不可撤销。')} (${node.name})`,
        t('workbench.delete', '删除')
      )
      if (!confirmed) return
      try {
        await window.api.agentWorkspace.deleteEntry(folderRoot, node.relativePath)
        const parentDir = parentRelativePath(node.relativePath)
        await tree.refreshPath(parentDir)
        if (tree.selectedPath === node.relativePath) {
          tree.selectPath(null)
        }
      } catch (error) {
        await dialog.alert(
          error instanceof Error ? error.message : t('common.error', '操作失败'),
          t('workbench.delete', '删除')
        )
      }
    },
    [dialog, folderRoot, t, tree]
  )

  const handleCopyPath = useCallback(
    async (node: FileTreeNode | null) => {
      if (!folderRoot) return
      const absolutePath = toAbsolutePath(folderRoot, node?.relativePath)
      try {
        await navigator.clipboard.writeText(absolutePath)
        toast.showSuccess(t('workbench.path_copied', '路径已复制'))
      } catch {
        toast.showError(t('workbench.copy_path_failed', '复制路径失败'))
      }
    },
    [folderRoot, t]
  )

  const handleRevealInExplorer = useCallback(
    async (node: FileTreeNode | null) => {
      if (!folderRoot) return
      try {
        await window.api.shell.showItemInFolder(toAbsolutePath(folderRoot, node?.relativePath))
      } catch {
        toast.showError(t('workbench.reveal_failed', '无法在资源管理器中打开'))
      }
    },
    [folderRoot, t]
  )

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FileTreeNode) => {
      event.preventDefault()
      event.stopPropagation()
      tree.selectPath(node.relativePath)
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: { kind: 'node', node }
      })
    },
    [tree]
  )

  const handleTreeContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      target: { kind: 'root' }
    })
  }, [])

  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return []
    return buildFileExplorerMenuItems({
      target: contextMenu.target,
      t,
      onOpenFile: handleSelect,
      onExpandFolder: (relativePath) => {
        if (!tree.isExpanded(relativePath)) {
          tree.toggleExpanded(relativePath)
        }
        tree.ensureExpanded(relativePath)
      },
      onNewFile: (parentDir) => void handleNewFile(parentDir),
      onNewFolder: (parentDir) => void handleNewFolder(parentDir),
      onRename: (node) => void handleRename(node),
      onDelete: (node) => void handleDelete(node),
      onCopyPath: handleCopyPath,
      onRevealInExplorer: handleRevealInExplorer,
      onRefresh: () => void tree.refreshRoot()
    })
  }, [
    contextMenu,
    handleCopyPath,
    handleDelete,
    handleNewFile,
    handleNewFolder,
    handleRename,
    handleRevealInExplorer,
    handleSelect,
    t,
    tree
  ])

  const selectedNode = resolveSelectedNode()

  if (!folderRoot) {
    return (
      <div className={styles.placeholder}>
        {t('agent_workspace.no_folder', '未选择文件夹')}
      </div>
    )
  }

  const rootPendingCreate =
    inlineEdit?.mode === 'create' && inlineEdit.parentDir === ''

  return (
    <div className={styles.explorer}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{t('workbench.files', '文件')}</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => void handleNewFile()}
            title={t('workbench.new_file', '新建文件')}
          >
            <FilePlus size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => void handleNewFolder()}
            title={t('workbench.new_folder', '新建文件夹')}
          >
            <FolderPlus size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => void tree.refreshRoot()}
            title={t('common.refresh', '刷新')}
          >
            <RefreshCw size={16} strokeWidth={1.75} />
          </button>
          {selectedNode ? (
            <>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => void handleRename(selectedNode)}
                title={t('workbench.rename', '重命名')}
              >
                <Pencil size={15} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => void handleDelete(selectedNode)}
                title={t('workbench.delete', '删除')}
              >
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className={styles.tree} onContextMenu={handleTreeContextMenu}>
        {tree.loadingRoot ? (
          <p className={styles.placeholder}>{t('common.loading', '加载中…')}</p>
        ) : tree.rootError ? (
          <p className={styles.error}>{tree.rootError}</p>
        ) : (
          <>
            {tree.rootChildren.map((node) => (
              <TreeNode
                key={node.relativePath}
                node={node}
                depth={0}
                selectedPath={tree.selectedPath}
                isExpanded={tree.isExpanded}
                getChildren={tree.getChildren}
                onToggle={tree.toggleExpanded}
                onSelect={handleSelect}
                onContextMenu={handleNodeContextMenu}
                inlineEdit={inlineEdit}
                onCommitInline={(name) => void commitInlineEdit(name)}
                onCancelInline={cancelInlineEdit}
              />
            ))}
            {rootPendingCreate ? (
              <InlineTreeNameRow
                depth={0}
                isDirectory={inlineEdit.kind === 'folder'}
                initialName={inlineEdit.initialName}
                existingNames={tree.rootChildren.map((child) => child.name)}
                onCommit={(name) => void commitInlineEdit(name)}
                onCancel={cancelInlineEdit}
              />
            ) : null}
            {tree.rootChildren.length === 0 && !rootPendingCreate ? (
              <p className={styles.placeholder}>{t('agent_workspace.empty_tree', '文件夹为空')}</p>
            ) : null}
          </>
        )}
      </div>
      <WorkbenchFileExplorerContextMenu
        menu={contextMenu}
        onClose={closeContextMenu}
        items={contextMenuItems}
      />
    </div>
  )
}
