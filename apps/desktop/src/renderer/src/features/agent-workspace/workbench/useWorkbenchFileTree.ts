import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AgentWorkspaceDirEntry } from '@baishou/shared'
import { parentRelativePath } from './workbench-path.util'

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

  useEffect(() => {
    if (!folderRoot) {
      setChildrenByPath({})
      setSelectedPath(null)
      setExpandedPaths(new Set(['']))
      return
    }
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
    setLoadingRoot(true)
    setRootError(null)
    try {
      await loadPath('')
      const expanded = loadExpandedPaths(folderRoot)
      setExpandedPaths(expanded)
      await Promise.all([...expanded].filter((path) => path !== '').map((path) => loadPath(path)))
    } catch (error) {
      setRootError(error instanceof Error ? error.message : 'Failed to load directory')
      setChildrenByPath({})
    } finally {
      setLoadingRoot(false)
    }
  }, [folderRoot, loadPath])

  useEffect(() => {
    void refreshRoot()
  }, [refreshRoot])

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

  const rootChildren = childrenByPath[''] ?? EMPTY_ROOT_CHILDREN

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
      getChildren,
      selectPath,
      refreshRoot,
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
      isExpanded,
      loadDirectory,
      loadPath,
      loadingRoot,
      refreshPath,
      refreshRoot,
      rootChildren,
      rootError,
      selectPath,
      selectedPath,
      toggleExpanded
    ]
  )
}
