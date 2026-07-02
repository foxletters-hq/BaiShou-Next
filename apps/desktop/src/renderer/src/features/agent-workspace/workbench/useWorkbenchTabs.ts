import { useCallback, useMemo, useState } from 'react'
import type { WorkspaceChangeEntry } from '@baishou/shared'
import { basenameFromPath } from '@baishou/ui'

export type WorkbenchTabKind = 'welcome' | 'markdown' | 'text' | 'diff'

export interface WorkbenchTab {
  id: string
  kind: WorkbenchTabKind
  title: string
  relativePath?: string
  content?: string
  truncated?: boolean
  change?: WorkspaceChangeEntry
  loading?: boolean
  error?: string | null
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

let tabCounter = 0
function nextTabId(): string {
  tabCounter += 1
  return `tab-${Date.now()}-${tabCounter}`
}

export function useWorkbenchTabs(folderRoot: string | null) {
  const [tabs, setTabs] = useState<WorkbenchTab[]>([
    { id: 'welcome', kind: 'welcome', title: 'Welcome' }
  ])
  const [activeTabId, setActiveTabId] = useState<string>('welcome')

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) ?? tabs[0],
    [activeTabId, tabs]
  )

  const openFile = useCallback(
    async (relativePath: string) => {
      if (!folderRoot) return
      const existing = tabs.find((tab) => tab.relativePath === relativePath && tab.kind !== 'diff')
      if (existing) {
        setActiveTabId(existing.id)
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
        loading: true
      }

      setTabs((prev) => [...prev.filter((tab) => tab.kind !== 'welcome'), placeholder])
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

  const openDiff = useCallback((change: WorkspaceChangeEntry) => {
    const existing = tabs.find((tab) => tab.kind === 'diff' && tab.change?.id === change.id)
    if (existing) {
      setActiveTabId(existing.id)
      return
    }

    const id = nextTabId()
    const title = `Δ ${basenameFromPath(change.path)}`
    setTabs((prev) => [
      ...prev.filter((tab) => tab.kind !== 'welcome'),
      { id, kind: 'diff', title, change, relativePath: change.path }
    ])
    setActiveTabId(id)
  }, [tabs])

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const next = prev.filter((tab) => tab.id !== tabId)
        if (next.length === 0) {
          return [{ id: 'welcome', kind: 'welcome', title: 'Welcome' }]
        }
        return next
      })
      setActiveTabId((current) => {
        if (current !== tabId) return current
        const remaining = tabs.filter((tab) => tab.id !== tabId)
        return remaining[remaining.length - 1]?.id ?? 'welcome'
      })
    },
    [tabs]
  )

  const updateTabContent = useCallback((tabId: string, content: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, content } : tab))
    )
  }, [])

  const resetTabs = useCallback(() => {
    setTabs([{ id: 'welcome', kind: 'welcome', title: 'Welcome' }])
    setActiveTabId('welcome')
  }, [])

  return {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    openFile,
    openDiff,
    closeTab,
    updateTabContent,
    resetTabs
  }
}
