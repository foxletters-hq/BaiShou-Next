import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast, useDialog } from '@baishou/ui'
import type { FileTreeNode } from './useWorkbenchFileTree'
import { readSkipMoveConfirm, writeSkipMoveConfirm } from '../utils/workspace-dont-ask-again.util'
import {
  canDropExplorerEntries,
  collectExternalAbsolutePaths,
  hasExternalFiles,
  isCopyDragModifier,
  parseExplorerDndPayload,
  resolveDropTargetDir,
  writeExplorerDndPayload,
  type WorkbenchExplorerDndPayload
} from './workbench-file-explorer-dnd.util'

const AUTO_EXPAND_MS = 600

export interface UseWorkbenchFileExplorerDndParams {
  folderRoot: string | null
  isExpanded: (path: string) => boolean
  ensureExpanded: (path: string) => void
  refreshRoot: () => Promise<void>
  selectPath: (relativePath: string | null) => void
}

export function useWorkbenchFileExplorerDnd({
  folderRoot,
  isExpanded,
  ensureExpanded,
  refreshRoot,
  selectPath
}: UseWorkbenchFileExplorerDndParams) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const [draggingPaths, setDraggingPaths] = useState<string[]>([])
  const [dropTargetDir, setDropTargetDir] = useState<string | null>(null)
  const [dropIsCopy, setDropIsCopy] = useState(false)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const expandTargetRef = useRef<string | null>(null)
  const busyRef = useRef(false)

  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current)
      expandTimerRef.current = null
    }
    expandTargetRef.current = null
  }, [])

  const resetDragUi = useCallback(() => {
    setDraggingPaths([])
    setDropTargetDir(null)
    setDropIsCopy(false)
    clearExpandTimer()
  }, [clearExpandTimer])

  useEffect(() => () => clearExpandTimer(), [clearExpandTimer])

  const scheduleAutoExpand = useCallback(
    (folderPath: string) => {
      if (!folderPath || isExpanded(folderPath)) {
        clearExpandTimer()
        return
      }
      if (expandTargetRef.current === folderPath && expandTimerRef.current) return
      clearExpandTimer()
      expandTargetRef.current = folderPath
      expandTimerRef.current = setTimeout(() => {
        ensureExpanded(folderPath)
        expandTimerRef.current = null
        expandTargetRef.current = null
      }, AUTO_EXPAND_MS)
    },
    [clearExpandTimer, ensureExpanded, isExpanded]
  )

  const handleDragStart = useCallback(
    (event: DragEvent, node: FileTreeNode) => {
      if (!folderRoot) return
      const paths =
        draggingPaths.includes(node.relativePath) && draggingPaths.length > 0
          ? draggingPaths
          : [node.relativePath]
      const payload: WorkbenchExplorerDndPayload = { relativePaths: paths }
      writeExplorerDndPayload(event.dataTransfer, payload)
      event.dataTransfer.setData('text/plain', paths.join('\n'))
      setDraggingPaths(paths)
    },
    [draggingPaths, folderRoot]
  )

  const handleDragEnd = useCallback(() => {
    resetDragUi()
  }, [resetDragUi])

  const updateDropTarget = useCallback(
    (
      event: DragEvent,
      target: { relativePath: string | null; isDirectory: boolean } | 'root'
    ) => {
      const isCopy = isCopyDragModifier(event)
      setDropIsCopy(isCopy)

      const targetDir =
        target === 'root'
          ? ''
          : resolveDropTargetDir({
              relativePath: target.relativePath,
              isDirectory: target.isDirectory
            })

      const internal = parseExplorerDndPayload(event.dataTransfer)
      // dragover 时自定义 mime 在部分浏览器读不到；用 draggingPaths 兜底
      const sourcePaths = internal?.relativePaths?.length
        ? internal.relativePaths
        : draggingPaths

      if (sourcePaths.length > 0) {
        const ok = canDropExplorerEntries({ sourcePaths, targetDir, isCopy })
        if (!ok) {
          event.dataTransfer.dropEffect = 'none'
          setDropTargetDir(null)
          clearExpandTimer()
          return false
        }
        event.dataTransfer.dropEffect = isCopy ? 'copy' : 'move'
        setDropTargetDir(targetDir)
        if (target !== 'root' && target.isDirectory && target.relativePath) {
          scheduleAutoExpand(target.relativePath)
        } else {
          clearExpandTimer()
        }
        return true
      }

      if (hasExternalFiles(event.dataTransfer)) {
        event.dataTransfer.dropEffect = 'copy'
        setDropTargetDir(targetDir)
        if (target !== 'root' && target.isDirectory && target.relativePath) {
          scheduleAutoExpand(target.relativePath)
        } else {
          clearExpandTimer()
        }
        return true
      }

      event.dataTransfer.dropEffect = 'none'
      setDropTargetDir(null)
      return false
    },
    [clearExpandTimer, draggingPaths, scheduleAutoExpand]
  )

  const handleDragOverNode = useCallback(
    (event: DragEvent, node: FileTreeNode) => {
      event.preventDefault()
      event.stopPropagation()
      updateDropTarget(event, {
        relativePath: node.relativePath,
        isDirectory: node.isDirectory
      })
    },
    [updateDropTarget]
  )

  const handleDragOverRoot = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      updateDropTarget(event, 'root')
    },
    [updateDropTarget]
  )

  const handleDragLeaveRoot = useCallback((event: DragEvent) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
    setDropTargetDir(null)
  }, [])

  const refreshAfterTransfer = useCallback(async () => {
    await refreshRoot()
  }, [refreshRoot])

  const commitInternalDrop = useCallback(
    async (sourcePaths: string[], targetDir: string, isCopy: boolean) => {
      if (!folderRoot || busyRef.current) return
      const valid = canDropExplorerEntries({ sourcePaths, targetDir, isCopy })
      if (!valid) return

      if (!isCopy && !readSkipMoveConfirm()) {
        const message =
          sourcePaths.length === 1
            ? t('workbench.dnd_move_confirm_one', '确定将「{{name}}」移动到目标文件夹？', {
                name: sourcePaths[0].split('/').pop()
              })
            : t('workbench.dnd_move_confirm_many', '确定移动 {{count}} 个项目到目标文件夹？', {
                count: sourcePaths.length
              })
        const result = await dialog.confirmWithDontAskAgain(
          message,
          t('workbench.dnd_move', '移动'),
          t('workbench.dnd_move_dont_ask_again', '不再提示')
        )
        if (!result.confirmed) return
        if (result.dontAskAgain) writeSkipMoveConfirm()
      }

      busyRef.current = true
      try {
        let lastPath: string | null = null
        for (const source of sourcePaths) {
          const result = isCopy
            ? await window.api.agentWorkspace.copyEntry(folderRoot, source, targetDir)
            : await window.api.agentWorkspace.moveEntry(folderRoot, source, targetDir)
          lastPath = result.relativePath
        }
        await refreshAfterTransfer()
        if (targetDir) ensureExpanded(targetDir)
        if (lastPath) selectPath(lastPath)
        toast.showSuccess(
          isCopy
            ? t('workbench.dnd_copy_done', '已复制')
            : t('workbench.dnd_move_done', '已移动')
        )
      } catch (error) {
        toast.showError(error instanceof Error ? error.message : t('common.error', '操作失败'))
      } finally {
        busyRef.current = false
      }
    },
    [dialog, ensureExpanded, folderRoot, refreshAfterTransfer, selectPath, t]
  )

  const commitExternalDrop = useCallback(
    async (targetDir: string, dataTransfer: DataTransfer) => {
      if (!folderRoot || busyRef.current) return
      const absolutePaths = collectExternalAbsolutePaths(dataTransfer)
      if (absolutePaths.length === 0) {
        toast.showError(t('workbench.dnd_external_empty', '无法读取拖入的文件路径'))
        return
      }
      busyRef.current = true
      try {
        const { imported } = await window.api.agentWorkspace.importExternalPaths(
          folderRoot,
          targetDir,
          absolutePaths
        )
        await refreshAfterTransfer()
        if (targetDir) ensureExpanded(targetDir)
        if (imported[0]) selectPath(imported[0])
        toast.showSuccess(
          t('workbench.dnd_import_done', '已导入 {{count}} 项', { count: imported.length })
        )
      } catch (error) {
        toast.showError(error instanceof Error ? error.message : t('common.error', '操作失败'))
      } finally {
        busyRef.current = false
      }
    },
    [ensureExpanded, folderRoot, refreshAfterTransfer, selectPath, t]
  )

  const handleDropOnTarget = useCallback(
    async (
      event: DragEvent,
      target: { relativePath: string | null; isDirectory: boolean } | 'root'
    ) => {
      event.preventDefault()
      event.stopPropagation()
      if (!folderRoot) return

      const isCopy = isCopyDragModifier(event)
      const targetDir =
        target === 'root'
          ? ''
          : resolveDropTargetDir({
              relativePath: target.relativePath,
              isDirectory: target.isDirectory
            })

      const internal = parseExplorerDndPayload(event.dataTransfer)
      const sourcePaths = internal?.relativePaths?.length
        ? internal.relativePaths
        : draggingPaths

      resetDragUi()

      if (sourcePaths.length > 0) {
        await commitInternalDrop(sourcePaths, targetDir, isCopy)
        return
      }

      if (hasExternalFiles(event.dataTransfer)) {
        await commitExternalDrop(targetDir, event.dataTransfer)
      }
    },
    [commitExternalDrop, commitInternalDrop, draggingPaths, folderRoot, resetDragUi]
  )

  return {
    draggingPaths,
    dropTargetDir,
    dropIsCopy,
    handleDragStart,
    handleDragEnd,
    handleDragOverNode,
    handleDragOverRoot,
    handleDragLeaveRoot,
    handleDropOnNode: (event: DragEvent, node: FileTreeNode) =>
      void handleDropOnTarget(event, {
        relativePath: node.relativePath,
        isDirectory: node.isDirectory
      }),
    handleDropOnRoot: (event: DragEvent) => void handleDropOnTarget(event, 'root')
  }
}
