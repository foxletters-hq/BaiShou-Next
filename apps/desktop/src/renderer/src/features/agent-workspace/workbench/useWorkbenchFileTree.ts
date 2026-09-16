import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgentWorkspaceDirEntry } from '@baishou/shared'
import {
  collectTouchedDirPaths,
  parentRelativePath,
  shouldApplyWorkspaceFsChange
} from './workbench-path.util'
import {
  collapsedExplorerExpandedPaths,
  explorerHasCollapsibleFolders,
  restoreExplorerExpandedPaths,
  snapshotExplorerExpandedPaths
} from './workbench-file-tree.util'

export interface FileTreeNode {
  relativePath: string
  name: string
  isDirectory: boolean
}

function treeStorageKey(folderRoot: string): string {
  return `baishou:workbench-tree:${folderRoot.replace(/\\/g, '/').toLowerCase()}`
}

function loadExpandedPaths(folderRoot: string): Set<string> {
  try {
    const raw = localStorage.getItem(treeStorageKey(folderRoot))
    if (!raw) return new Set([''])
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set([''])
    return new Set(parsed.filter((p): p is string => typeof p === 'string'))
  } catch {
    return new Set([''])
  }
}

function persistExpandedPaths(folderRoot: string, paths: Set<string>): void {
  localStorage.setItem(treeStorageKey(folderRoot), JSON.stringify([...paths]))
}

const EMPTY_ROOT_CHILDREN: FileTreeNode[] = []

function sortEntries(entries: AgentWorkspaceDirEntry[]): AgentWorkspaceDirEntry[] {
  return [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export function useWorkbenchFileTree(folderRoot: string | null) {
  const [childrenByPath, setChildrenByPath] = useState<Record<string, FileTreeNode[]>>({})
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set(['']))
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [loadingRoot, setLoadingRoot] = useState(false)
  const [rootError, setRootError] = useState<string | null>(null)
  const hasLoadedOnceRef = useRef(false)
  const collapseSnapshotRef = useRef<string[] | null>(null)

  useEffect(() => {
    collapseSnapshotRef.current = null
    if (!folderRoot) {
      setChildrenByPath({})
      setSelectedPath(null)
      setExpandedPaths(new Set(['']))
      hasLoadedOnceRef.current = false
      return
    }
    hasLoadedOnceRef.current = false
    setExpandedPaths(loadExpandedPaths(folderRoot))
    setChildrenByPath({})
  }, [folderRoot])

  const listDirectory = useCallback(
    async (relativePath: string): Promise<FileTreeNode[]> => {
      if (!folderRoot) return []
      const entries = await window.api.agentWorkspace.listDir(folderRoot, relativePath || undefined)
      return sortEntries(entries).map((entry) => ({
        relativePath: entry.relativePath,
        name: entry.name,
        isDirectory: entry.isDirectory
      }))
    },
    [folderRoot]
  )

  const loadPath = useCallback(
    async (relativePath: string) => {
      const nodes = await listDirectory(relativePath)
      setChildrenByPath((prev) => ({ ...prev, [relativePath]: nodes }))
      return nodes
    },
    [listDirectory]
  )

  const refreshRoot = useCallback(async () => {
    if (!folderRoot) return
    const isInitialLoad = !hasLoadedOnceRef.current
    if (isInitialLoad) setLoadingRoot(true)
    setRootError(null)
    try {
      await loadPath('')
      const expanded = loadExpandedPaths(folderRoot)
      setExpandedPaths(expanded)
      await Promise.all([...expanded].filter((path) => path !== '').map((path) => loadPath(path)))
      hasLoadedOnceRef.current = true
    } catch (error) {
      setRootError(error instanceof Error ? error.message : 'Failed to load directory')
      if (isInitialLoad) setChildrenByPath({})
    } finally {
      setLoadingRoot(false)
    }
  }, [folderRoot, loadPath])

  /** AI 写盘后的静默刷新：只重拉已展开目录，不闪「加载中」、不拆掉当前树 */
  const softRefreshExpanded = useCallback(async () => {
    if (!folderRoot) return
    try {
      const paths = [...expandedPaths]
      await Promise.all(paths.map((path) => loadPath(path)))
    } catch {
      /* 保留现有节点，避免把侧栏刷空 */
    }
  }, [expandedPaths, folderRoot, loadPath])

  const loadPathRef = useRef(loadPath)
  const softRefreshExpandedRef = useRef(softRefreshExpanded)
  loadPathRef.current = loadPath
  softRefreshExpandedRef.current = softRefreshExpanded

  useEffect(() => {
    void refreshRoot()
  }, [refreshRoot])

  // 只随当前目录启停监听与订阅；展开集合变化不得重建 chokidar
  useEffect(() => {
    if (!folderRoot) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false
    let pending: Set<string> | 'all' = new Set()
    const flush = () => {
      timer = null
      const queued = pending
      pending = new Set()
      if (queued === 'all') {
        void softRefreshExpandedRef.current()
        return
      }
      const dirs = collectTouchedDirPaths(queued)
      if (dirs.length === 0) {
        void softRefreshExpandedRef.current()
        return
      }
      void Promise.all(dirs.map((dir) => loadPathRef.current(dir))).catch(() => {
        /* 保留现有节点 */
      })
    }
    const queueRefresh = (relativePath?: string, previousPath?: string) => {
      if (!relativePath && !previousPath) {
        pending = 'all'
      } else if (pending !== 'all') {
        if (relativePath) pending.add(relativePath)
        if (previousPath) pending.add(previousPath)
      }
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 80)
    }
    const onTreeRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ relativePath?: string; previousPath?: string }>)
        .detail
      queueRefresh(detail?.relativePath, detail?.previousPath)
    }
    const unsubscribeFs = window.api.agentWorkspace.onFsChanged?.((payload) => {
      if (!shouldApplyWorkspaceFsChange(folderRoot, payload.folderRoot)) return
      queueRefresh(payload.path, payload.previousPath)
    })
    window.addEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const startWatch = async () => {
      const ok = await window.api.agentWorkspace.watchFolder?.(folderRoot)
      if (cancelled || ok !== false) return
      retryTimer = setTimeout(() => {
        if (!cancelled) void window.api.agentWorkspace.watchFolder?.(folderRoot)
      }, 100)
    }
    void startWatch()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      if (retryTimer) clearTimeout(retryTimer)
      unsubscribeFs?.()
      window.removeEventListener('baishou:workspace-tree-refresh', onTreeRefresh)
      void window.api.agentWorkspace.unwatchFolder?.(folderRoot)
    }
  }, [folderRoot])

  const toggleExpanded = useCallback(
    (relativePath: string) => {
      setExpandedPaths((prev) => {
        const next = new Set(prev)
        if (next.has(relativePath)) {
          next.delete(relativePath)
        } else {
          next.add(relativePath)
          void loadPath(relativePath)
        }
        if (folderRoot) persistExpandedPaths(folderRoot, next)
        return next
      })
    },
    [folderRoot, loadPath]
  )

  const collapseAllFolders = useCallback(() => {
    setExpandedPaths((prev) => {
      if (!explorerHasCollapsibleFolders(prev)) return prev
      collapseSnapshotRef.current = snapshotExplorerExpandedPaths(prev)
      const next = collapsedExplorerExpandedPaths()
      if (folderRoot) persistExpandedPaths(folderRoot, next)
      return next
    })
  }, [folderRoot])

  const rootChildren = childrenByPath[''] ?? EMPTY_ROOT_CHILDREN

  const expandCollapsedFolders = useCallback(() => {
    const snapshot = collapseSnapshotRef.current
    const fallback = rootChildren
      .filter((node) => node.isDirectory)
      .map((node) => node.relativePath)
    const paths = snapshot && snapshot.length > 0 ? snapshot : fallback
    if (paths.length === 0) return
    const next = restoreExplorerExpandedPaths(paths)
    setExpandedPaths(next)
    if (folderRoot) persistExpandedPaths(folderRoot, next)
    void Promise.all(paths.map((path) => loadPath(path))).catch(() => {
      /* 展开失败时保留已写入的展开状态 */
    })
  }, [folderRoot, loadPath, rootChildren])

  const toggleAllFolders = useCallback(() => {
    if (explorerHasCollapsibleFolders(expandedPaths)) {
      collapseAllFolders()
      return
    }
    expandCollapsedFolders()
  }, [collapseAllFolders, expandCollapsedFolders, expandedPaths])

  const canCollapseAllFolders = explorerHasCollapsibleFolders(expandedPaths)
  const canToggleAllFolders =
    canCollapseAllFolders || rootChildren.some((node) => node.isDirectory)

  const isExpanded = useCallback(
    (relativePath: string) => expandedPaths.has(relativePath),
    [expandedPaths]
  )

  const getChildren = useCallback(
    (relativePath: string) => childrenByPath[relativePath] ?? [],
    [childrenByPath]
  )

  const selectPath = useCallback((relativePath: string | null) => {
    setSelectedPath(relativePath)
  }, [])

  const refreshPath = useCallback(
    async (relativePath: string) => {
      const parent = relativePath === '' ? '' : parentRelativePath(relativePath)
      await loadPath(parent === relativePath ? '' : parent)
      if (relativePath !== '' && expandedPaths.has(parentRelativePath(relativePath))) {
        await loadPath(parentRelativePath(relativePath))
      }
      if (relativePath === '' || expandedPaths.has(relativePath)) {
        await loadPath(relativePath)
      }
    },
    [expandedPaths, loadPath]
  )

  const loadDirectory = loadPath

  return useMemo(
    () => ({
      rootChildren,
      loadingRoot,
      rootError,
      selectedPath,
      isExpanded,
      toggleExpanded,
      collapseAllFolders,
      toggleAllFolders,
      canCollapseAllFolders,
      canToggleAllFolders,
      getChildren,
      selectPath,
      refreshRoot,
      softRefreshExpanded,
      refreshPath,
      loadDirectory,
      ensureExpanded: (relativePath: string) => {
        setExpandedPaths((prev) => {
          if (prev.has(relativePath)) return prev
          const next = new Set(prev)
          next.add(relativePath)
          if (folderRoot) persistExpandedPaths(folderRoot, next)
          return next
        })
        void loadPath(relativePath)
      }
    }),
    [
      folderRoot,
      getChildren,
      canCollapseAllFolders,
      canToggleAllFolders,
      collapseAllFolders,
      toggleAllFolders,
      isExpanded,
      loadDirectory,
      loadPath,
      loadingRoot,
      refreshPath,
      refreshRoot,
      softRefreshExpanded,
      rootChildren,
      rootError,
      selectPath,
      selectedPath,
      toggleExpanded
    ]
  )
}
