import { useCallback, useMemo, useState } from 'react'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { basenameFromPath } from '@baishou/ui'

export type WorkbenchTabKind = 'markdown' | 'text' | 'diff' | 'git-diff'

export interface WorkbenchTab {
  id: string
  kind: WorkbenchTabKind
  title: string
  relativePath?: string
  content?: string
  truncated?: boolean
  change?: WorkspaceChangeEntry
  fileDiff?: import('@baishou/shared').FileDiff
  gitDiffStaged?: boolean
  gitDiffCommitHash?: string
  gitDiffEditable?: boolean
  gitDiffReadOnly?: boolean
  gitDiffOriginal?: string
  loading?: boolean
  error?: string | null
  scrollToLine?: number
  scrollToColumn?: number
}

export interface WorkbenchOpenFileOptions {
  line?: number
  column?: number
}

function isMarkdownPath(path: string): boolean {
  const lower = path.toLowerCase()
  return (
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    lower.endsWith('.mdx') ||
    lower.endsWith('.txt')
  )
}

function isReloadableFileTab(tab: WorkbenchTab): boolean {
  if (!tab.relativePath || tab.loading) return false
  if (tab.kind === 'markdown' || tab.kind === 'text') return true
  return tab.kind === 'git-diff' && Boolean(tab.gitDiffEditable)
}

let tabCounter = 0
function nextTabId(): string {
  tabCounter += 1
  return `tab-${Date.now()}-${tabCounter}`
}

function diffTabId(changeId: string): string {
  return `diff:${changeId}`
}

export function useWorkbenchTabs(folderRoot: string | null) {
  const [tabs, setTabs] = useState<WorkbenchTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const activeTab = useMemo(
    () => (activeTabId ? tabs.find((tab) => tab.id === activeTabId) : undefined) ?? tabs[0],
    [activeTabId, tabs]
  )

  const openFile = useCallback(
    async (relativePath: string, options?: WorkbenchOpenFileOptions) => {
      if (!folderRoot) return
      const existing = tabs.find((tab) => tab.relativePath === relativePath && tab.kind !== 'diff')
      if (existing) {
        setActiveTabId(existing.id)
        try {
          const result = await window.api.agentWorkspace.readFile(folderRoot, relativePath)
          setTabs((prev) =>
            prev.map((tab) =>
              tab.id === existing.id
                ? {
                    ...tab,
                    content: result.content,
                    truncated: result.truncated,
                    error: null,
                    scrollToLine: options?.line ?? tab.scrollToLine,
                    scrollToColumn: options?.column ?? tab.scrollToColumn
                  }
                : tab
            )
          )
        } catch (error) {
          setTabs((prev) =>
            prev.map((tab) =>
              tab.id === existing.id
                ? {
                    ...tab,
                    error: error instanceof Error ? error.message : 'Failed to load',
                    scrollToLine: options?.line ?? tab.scrollToLine,
                    scrollToColumn: options?.column ?? tab.scrollToColumn
                  }
                : tab
            )
          )
        }
        return
      }

      const id = nextTabId()
      const title = basenameFromPath(relativePath)
      const kind: WorkbenchTabKind = isMarkdownPath(relativePath) ? 'markdown' : 'text'
      const placeholder: WorkbenchTab = {
        id,
        kind,
        title,
        relativePath,
        loading: true,
        scrollToLine: options?.line,
        scrollToColumn: options?.column
      }

      setTabs((prev) => [...prev, placeholder])
      setActiveTabId(id)

      try {
        const result = await window.api.agentWorkspace.readFile(folderRoot, relativePath)
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === id
              ? {
                  ...tab,
                  loading: false,
                  content: result.content,
                  truncated: result.truncated
                }
              : tab
          )
        )
      } catch (error) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === id
              ? {
                  ...tab,
                  loading: false,
                  error: error instanceof Error ? error.message : 'Failed to load'
                }
              : tab
          )
        )
      }
    },
    [folderRoot, tabs]
  )

  const openDiffs = useCallback((changes: WorkspaceChangeEntry[]) => {
    if (changes.length === 0) return

    const focusId = diffTabId(changes[changes.length - 1]!.id)

    setTabs((prev) => {
      let next = prev
      let changed = false
      for (const change of changes) {
        const id = diffTabId(change.id)
        const existingIndex = next.findIndex((tab) => tab.id === id)
        if (existingIndex >= 0) {
          const existing = next[existingIndex]!
          if (existing.change !== change) {
            if (!changed) {
              next = [...next]
              changed = true
            }
            next[existingIndex] = {
              ...existing,
              change,
              relativePath: change.path,
              title: `Δ ${basenameFromPath(change.path)}`
            }
          }
          continue
        }
        if (!changed) {
          next = [...next]
          changed = true
        }
        next.push({
          id,
          kind: 'diff',
          title: `Δ ${basenameFromPath(change.path)}`,
          change,
          relativePath: change.path
        })
      }
      return changed ? next : prev
    })
    setActiveTabId(focusId)
  }, [])

  const openDiff = useCallback(
    (change: WorkspaceChangeEntry) => {
      openDiffs([change])
    },
    [openDiffs]
  )

  const openGitDiff = useCallback(
    async (filePath: string, options?: { staged?: boolean; commitHash?: string }) => {
      if (!folderRoot) return
      const staged = options?.staged ?? false
      const commitHash = options?.commitHash

      if (!commitHash) {
        const id = `git-editable-${filePath}-${staged ? 'staged' : 'working'}`
        const existing = tabs.find((tab) => tab.id === id)
        if (existing) {
          setActiveTabId(existing.id)
          return
        }

        const title = `Δ ${basenameFromPath(filePath)}`
        const placeholder: WorkbenchTab = {
          id,
          kind: 'git-diff',
          title,
          relativePath: filePath,
          gitDiffStaged: staged,
          gitDiffEditable: true,
          loading: true
        }

        setTabs((prev) => [...prev, placeholder])
        setActiveTabId(id)

        try {
          const [fileResult, headContent] = await Promise.all([
            window.api.agentWorkspace.readFile(folderRoot, filePath),
            window.api.agentWorkspace.git.getHeadFileContent(folderRoot, filePath)
          ])
          setTabs((prev) =>
            prev.map((tab) =>
              tab.id === id
                ? {
                    ...tab,
                    loading: false,
                    content: fileResult.content,
                    gitDiffOriginal: headContent ?? '',
                    truncated: fileResult.truncated
                  }
                : tab
            )
          )
        } catch (error) {
          setTabs((prev) =>
            prev.map((tab) =>
              tab.id === id
                ? {
                    ...tab,
                    loading: false,
                    error: error instanceof Error ? error.message : 'Failed to load file'
                  }
                : tab
            )
          )
        }
        return
      }

      const id = `git-diff-${filePath}-commit-${commitHash}`
      const existing = tabs.find((tab) => tab.id === id)
      if (existing) {
        setActiveTabId(existing.id)
        return
      }

      const shortHash = commitHash.slice(0, 7)
      const title = `${basenameFromPath(filePath)} (${shortHash})`
      const placeholder: WorkbenchTab = {
        id,
        kind: 'git-diff',
        title,
        relativePath: filePath,
        gitDiffCommitHash: commitHash,
        gitDiffReadOnly: true,
        loading: true
      }

      setTabs((prev) => [...prev, placeholder])
      setActiveTabId(id)

      try {
        const [modified, original] = await Promise.all([
          window.api.agentWorkspace.git.getFileContentAtRevision(folderRoot, filePath, commitHash),
          window.api.agentWorkspace.git.getFileContentAtRevision(
            folderRoot,
            filePath,
            `${commitHash}~1`
          )
        ])
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === id
              ? {
                  ...tab,
                  loading: false,
                  content: modified ?? '',
                  gitDiffOriginal: original ?? ''
                }
              : tab
          )
        )
      } catch (error) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === id
              ? {
                  ...tab,
                  loading: false,
                  error: error instanceof Error ? error.message : 'Failed to load revision'
                }
              : tab
          )
        )
      }
    },
    [folderRoot, tabs]
  )

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => prev.filter((tab) => tab.id !== tabId))
      setActiveTabId((current) => {
        if (current !== tabId) return current
        const remaining = tabs.filter((tab) => tab.id !== tabId)
        return remaining[remaining.length - 1]?.id ?? null
      })
    },
    [tabs]
  )

  const reorderTabs = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
    setTabs((prev) => {
      if (fromIndex >= prev.length || toIndex >= prev.length) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      if (!moved) return prev
      next.splice(toIndex, 0, moved)
      return next
    })
  }, [])

  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, content } : tab)))
  }, [])

  const reloadOpenFileContents = useCallback(async () => {
    if (!folderRoot) return
    const targets = tabs.filter(isReloadableFileTab)
    if (targets.length === 0) return

    const updates = await Promise.all(
      targets.map(async (tab) => {
        try {
          const result = await window.api.agentWorkspace.readFile(folderRoot, tab.relativePath!)
          return { id: tab.id, content: result.content, truncated: result.truncated, error: null }
        } catch (error) {
          return {
            id: tab.id,
            error: error instanceof Error ? error.message : 'Failed to load'
          }
        }
      })
    )

    setTabs((prev) =>
      prev.map((tab) => {
        const update = updates.find((item) => item.id === tab.id)
        if (!update) return tab
        return {
          ...tab,
          content: update.content ?? tab.content,
          truncated: update.truncated ?? tab.truncated,
          error: update.error
        }
      })
    )
  }, [folderRoot, tabs])

  const resetTabs = useCallback(() => {
    setTabs([])
    setActiveTabId(null)
  }, [])

  const clearTabScrollTarget = useCallback((tabId: string) => {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === tabId ? { ...tab, scrollToLine: undefined, scrollToColumn: undefined } : tab
      )
    )
  }, [])

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    openFile,
    openDiff,
    openDiffs,
    openGitDiff,
    closeTab,
    reorderTabs,
    updateTabContent,
    reloadOpenFileContents,
    clearTabScrollTarget,
    resetTabs
  }
}
