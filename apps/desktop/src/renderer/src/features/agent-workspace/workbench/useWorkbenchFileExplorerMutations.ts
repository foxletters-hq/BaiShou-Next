import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast, useDialog } from '@baishou/ui'
import type { FileTreeNode } from './useWorkbenchFileTree'
import { suggestUniqueEntryName } from './workbench-inline-name.util'
import {
  joinRelativePath,
  parentRelativePath,
  toAbsoluteWorkspacePath
} from './workbench-path.util'
import type { InlineTreeEditState } from './WorkbenchFileExplorerInlineEdit'

export interface WorkbenchFileExplorerMutationTree {
  ensureExpanded: (path: string) => void
  loadDirectory: (path: string) => Promise<FileTreeNode[]>
  refreshPath: (path: string) => Promise<void>
  selectPath: (path: string | null) => void
  selectedPath: string | null
}

export interface UseWorkbenchFileExplorerMutationsParams {
  folderRoot: string | null
  tree: WorkbenchFileExplorerMutationTree
  getParentDir: () => string
  onOpenFile: (relativePath: string) => void
}

export function useWorkbenchFileExplorerMutations({
  folderRoot,
  tree,
  getParentDir,
  onOpenFile
}: UseWorkbenchFileExplorerMutationsParams) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const [inlineEdit, setInlineEdit] = useState<InlineTreeEditState | null>(null)

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
            const created = await window.api.agentWorkspace.createDirectory(
              folderRoot,
              relativePath
            )
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
        window.dispatchEvent(
          new CustomEvent('baishou:workspace-entry-deleted', {
            detail: { relativePath: node.relativePath }
          })
        )
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
      const absolutePath = toAbsoluteWorkspacePath(folderRoot, node?.relativePath)
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
        await window.api.shell.showItemInFolder(
          toAbsoluteWorkspacePath(folderRoot, node?.relativePath)
        )
      } catch {
        toast.showError(t('workbench.reveal_failed', '无法在资源管理器中打开'))
      }
    },
    [folderRoot, t]
  )

  return {
    inlineEdit,
    cancelInlineEdit,
    commitInlineEdit,
    handleNewFile,
    handleNewFolder,
    handleRename,
    handleDelete,
    handleCopyPath,
    handleRevealInExplorer
  }
}
