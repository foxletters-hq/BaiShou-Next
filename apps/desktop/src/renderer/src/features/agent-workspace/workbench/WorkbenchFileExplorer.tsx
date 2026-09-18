import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkbenchFileTree, type FileTreeNode } from './useWorkbenchFileTree'
import { ancestorDirPaths, resolveExplorerParentDir } from './workbench-path.util'
import {
  buildFileExplorerMenuItems,
  WorkbenchFileExplorerContextMenu,
  useCloseOnScroll,
  type FileExplorerContextMenuState
} from './WorkbenchFileExplorerContextMenu'
import { InlineTreeNameRow } from './WorkbenchFileExplorerInlineEdit'
import { useWorkbenchFileExplorerDnd } from './useWorkbenchFileExplorerDnd'
import { useWorkbenchFileExplorerMutations } from './useWorkbenchFileExplorerMutations'
import { WorkbenchFileExplorerToolbar } from './WorkbenchFileExplorerToolbar'
import { WorkbenchFileExplorerTreeNode } from './WorkbenchFileExplorerTreeNode'
import {
  findExplorerNode,
  flattenVisibleExplorerNodes,
  nextExplorerSelection,
  readWorkbenchRevealPath,
  resolveExplorerAddToChatEntries,
  WORKBENCH_REVEAL_PATH_EVENT
} from './workbench-explorer-selection.util'
import styles from './WorkbenchFileExplorer.module.css'

export interface WorkbenchFileExplorerProps {
  folderRoot: string | null
  onOpenFile: (relativePath: string) => void
  onAddToChat?: (entries: Array<{ relativePath: string; isDirectory: boolean }>) => void
}

export const WorkbenchFileExplorer: React.FC<WorkbenchFileExplorerProps> = ({
  folderRoot,
  onOpenFile,
  onAddToChat
}) => {
  const { t } = useTranslation()
  const tree = useWorkbenchFileTree(folderRoot)
  const [contextMenu, setContextMenu] = useState<FileExplorerContextMenuState | null>(null)
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [anchorPath, setAnchorPath] = useState<string | null>(null)
  const dnd = useWorkbenchFileExplorerDnd({
    folderRoot,
    isExpanded: tree.isExpanded,
    ensureExpanded: tree.ensureExpanded,
    refreshRoot: tree.softRefreshExpanded,
    selectPath: tree.selectPath
  })

  const closeContextMenu = useCallback(() => setContextMenu(null), [])
  useCloseOnScroll(closeContextMenu, Boolean(contextMenu))

  const selectedPathSet = useMemo(() => new Set(selectedPaths), [selectedPaths])
  const visibleNodes = useMemo(
    () => flattenVisibleExplorerNodes(tree.rootChildren, tree.getChildren, tree.isExpanded),
    [tree]
  )

  const replaceSelection = useCallback(
    (relativePath: string) => {
      setSelectedPaths([relativePath])
      setAnchorPath(relativePath)
      tree.selectPath(relativePath)
    },
    [tree]
  )

  const resolveNode = useCallback(
    (relativePath: string): FileTreeNode =>
      findExplorerNode(tree.rootChildren, relativePath, tree.getChildren) ?? {
        relativePath,
        name: relativePath.split('/').pop() ?? relativePath,
        isDirectory: false
      },
    [tree]
  )

  useEffect(() => {
    setSelectedPaths([])
    setAnchorPath(null)
  }, [folderRoot])

  useEffect(() => {
    const onReveal = (event: Event) => {
      const detail = readWorkbenchRevealPath(event)
      if (!detail) return
      for (const dir of ancestorDirPaths(detail.relativePath)) {
        if (dir) tree.ensureExpanded(dir)
      }
      if (detail.isDirectory) tree.ensureExpanded(detail.relativePath)
      replaceSelection(detail.relativePath)
    }
    window.addEventListener(WORKBENCH_REVEAL_PATH_EVENT, onReveal)
    return () => window.removeEventListener(WORKBENCH_REVEAL_PATH_EVENT, onReveal)
  }, [replaceSelection, tree])

  const resolveSelectedNode = useCallback((): FileTreeNode | null => {
    if (!tree.selectedPath) return null
    return resolveNode(tree.selectedPath)
  }, [resolveNode, tree.selectedPath])

  const getParentDir = useCallback(
    () => resolveExplorerParentDir(resolveSelectedNode()),
    [resolveSelectedNode]
  )

  const mutations = useWorkbenchFileExplorerMutations({
    folderRoot,
    tree,
    getParentDir,
    onOpenFile
  })

  const handleSelect = useCallback(
    (relativePath: string, event?: React.MouseEvent) => {
      const additive = Boolean(event?.ctrlKey || event?.metaKey)
      const range = Boolean(event?.shiftKey)
      const next = nextExplorerSelection({
        visiblePaths: visibleNodes.map((node) => node.relativePath),
        current: selectedPaths,
        clicked: relativePath,
        additive,
        range,
        anchor: anchorPath
      })
      setSelectedPaths(next.selected)
      setAnchorPath(next.anchor)
      tree.selectPath(relativePath)
      if (additive || range) return
      const node = resolveNode(relativePath)
      if (node.isDirectory) {
        tree.toggleExpanded(relativePath)
        return
      }
      onOpenFile(relativePath)
    },
    [anchorPath, onOpenFile, resolveNode, selectedPaths, tree, visibleNodes]
  )

  const handleOpenFromMenu = useCallback(
    (relativePath: string) => {
      replaceSelection(relativePath)
      onOpenFile(relativePath)
    },
    [onOpenFile, replaceSelection]
  )

  const handleAddToChat = useCallback(
    (target: FileTreeNode) => {
      if (!onAddToChat) return
      const selectedNodes = selectedPaths.map(resolveNode)
      onAddToChat(resolveExplorerAddToChatEntries(target, selectedNodes))
    },
    [onAddToChat, resolveNode, selectedPaths]
  )

  const selectedDragEntries = useMemo(
    () => selectedPaths.map(resolveNode),
    [resolveNode, selectedPaths]
  )

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: FileTreeNode) => {
      event.preventDefault()
      event.stopPropagation()
      if (!selectedPathSet.has(node.relativePath)) {
        replaceSelection(node.relativePath)
      } else {
        tree.selectPath(node.relativePath)
      }
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target: { kind: 'node', node }
      })
    },
    [replaceSelection, selectedPathSet, tree]
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
      onOpenFile: handleOpenFromMenu,
      onAddToChat: handleAddToChat,
      onExpandFolder: (relativePath) => {
        if (!tree.isExpanded(relativePath)) {
          tree.toggleExpanded(relativePath)
        }
        tree.ensureExpanded(relativePath)
      },
      onNewFile: (parentDir) => void mutations.handleNewFile(parentDir),
      onNewFolder: (parentDir) => void mutations.handleNewFolder(parentDir),
      onRename: (node) => void mutations.handleRename(node),
      onDelete: (node) => void mutations.handleDelete(node),
      onCopyPath: mutations.handleCopyPath,
      onRevealInExplorer: mutations.handleRevealInExplorer,
      onRefresh: () => void tree.softRefreshExpanded()
    })
  }, [contextMenu, handleAddToChat, handleOpenFromMenu, mutations, t, tree])

  const selectedNode = resolveSelectedNode()

  if (!folderRoot) {
    return (
      <div className={styles.placeholder}>{t('agent_workspace.no_folder', '未选择文件夹')}</div>
    )
  }

  const rootPendingCreate =
    mutations.inlineEdit?.mode === 'create' && mutations.inlineEdit.parentDir === ''

  return (
    <div className={styles.explorer}>
      <WorkbenchFileExplorerToolbar
        canToggleAllFolders={tree.canToggleAllFolders}
        canCollapseAllFolders={tree.canCollapseAllFolders}
        hasSelectedNode={Boolean(selectedNode)}
        onNewFile={() => void mutations.handleNewFile()}
        onNewFolder={() => void mutations.handleNewFolder()}
        onRefresh={() => void tree.softRefreshExpanded()}
        onToggleAllFolders={() => tree.toggleAllFolders()}
        onDeleteSelected={() => {
          if (selectedNode) void mutations.handleDelete(selectedNode)
        }}
      />
      <div
        className={`${styles.tree} ${dnd.dropTargetDir === '' ? styles.treeDropTarget : ''}`}
        onContextMenu={handleTreeContextMenu}
        onDragOver={dnd.handleDragOverRoot}
        onDragLeave={dnd.handleDragLeaveRoot}
        onDrop={dnd.handleDropOnRoot}
      >
        {tree.loadingRoot && tree.rootChildren.length === 0 ? (
          <p className={styles.placeholder}>{t('common.loading', '加载中…')}</p>
        ) : tree.rootError && tree.rootChildren.length === 0 ? (
          <p className={styles.error}>{tree.rootError}</p>
        ) : (
          <>
            {tree.rootChildren.map((node) => (
              <WorkbenchFileExplorerTreeNode
                key={node.relativePath}
                node={node}
                depth={0}
                selectedPaths={selectedPathSet}
                isExpanded={tree.isExpanded}
                getChildren={tree.getChildren}
                onToggle={tree.toggleExpanded}
                onSelect={handleSelect}
                onContextMenu={handleNodeContextMenu}
                inlineEdit={mutations.inlineEdit}
                onCommitInline={(name) => void mutations.commitInlineEdit(name)}
                onCancelInline={mutations.cancelInlineEdit}
                draggingPaths={dnd.draggingPaths}
                dropTargetDir={dnd.dropTargetDir}
                onDragStart={(event, node) => dnd.handleDragStart(event, node, selectedDragEntries)}
                onDragEnd={dnd.handleDragEnd}
                onDragOver={dnd.handleDragOverNode}
                onDrop={dnd.handleDropOnNode}
              />
            ))}
            {rootPendingCreate && mutations.inlineEdit?.mode === 'create' ? (
              <InlineTreeNameRow
                depth={0}
                isDirectory={mutations.inlineEdit.kind === 'folder'}
                initialName={mutations.inlineEdit.initialName}
                existingNames={tree.rootChildren.map((child) => child.name)}
                onCommit={(name) => void mutations.commitInlineEdit(name)}
                onCancel={mutations.cancelInlineEdit}
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
