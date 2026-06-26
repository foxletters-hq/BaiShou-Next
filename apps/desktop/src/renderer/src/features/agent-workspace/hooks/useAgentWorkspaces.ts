import { useCallback, useEffect, useState } from 'react'
import type { AgentWorkspaceEntry } from '@baishou/shared'

const WORKSPACES_CHANGED_EVENT = 'baishou:agent-workspaces-changed'

function normalizeFolderKey(folderRoot: string): string {
  return folderRoot.replace(/\\/g, '/').toLowerCase()
}

function upsertWorkspaceEntry(
  list: AgentWorkspaceEntry[],
  entry: AgentWorkspaceEntry
): AgentWorkspaceEntry[] {
  const key = normalizeFolderKey(entry.folderRoot)
  const index = list.findIndex((item) => normalizeFolderKey(item.folderRoot) === key)
  if (index < 0) return [entry, ...list]
  const next = [...list]
  next[index] = { ...next[index], ...entry, id: next[index].id }
  return next
}

export function notifyAgentWorkspacesChanged(): void {
  window.dispatchEvent(new CustomEvent(WORKSPACES_CHANGED_EVENT))
}

export function useAgentWorkspaces() {
  const [workspaces, setWorkspaces] = useState<AgentWorkspaceEntry[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const listWorkspaces = window.api?.agentWorkspace?.listWorkspaces
    if (!listWorkspaces) {
      console.warn('[useAgentWorkspaces] listWorkspaces API unavailable')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [list, lastActiveId] = await Promise.all([
        listWorkspaces(),
        window.api?.agentWorkspace?.getLastActiveWorkspaceId?.() ?? Promise.resolve(undefined)
      ])
      if (!Array.isArray(list)) return

      setWorkspaces((prev) => (list.length === 0 && prev.length > 0 ? prev : list))
      setActiveWorkspaceId((prev) => {
        if (prev && list.some((entry) => entry.id === prev)) return prev
        if (lastActiveId && list.some((entry) => entry.id === lastActiveId)) return lastActiveId
        return list[0]?.id ?? prev
      })
    } catch (error) {
      console.error('[useAgentWorkspaces] refresh failed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const onChanged = () => void refresh()
    window.addEventListener(WORKSPACES_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(WORKSPACES_CHANGED_EVENT, onChanged)
  }, [refresh])

  const selectWorkspace = useCallback(async (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId)
    try {
      await window.api?.agentWorkspace?.setLastActiveWorkspaceId?.(workspaceId)
    } catch {
      /* ignore */
    }
  }, [])

  const registerWorkspaceFolder = useCallback(
    async (folderRoot: string): Promise<AgentWorkspaceEntry | null> => {
      const addWorkspace = window.api?.agentWorkspace?.addWorkspace
      if (!addWorkspace) {
        throw new Error('agentWorkspace.addWorkspace API unavailable — 请重启应用以加载最新主进程')
      }
      const entry = await addWorkspace(folderRoot)
      if (!entry) {
        throw new Error('register workspace failed')
      }
      setWorkspaces((prev) => upsertWorkspaceEntry(prev, entry))
      setActiveWorkspaceId(entry.id)
      await selectWorkspace(entry.id)
      return entry
    },
    [selectWorkspace]
  )

  const addWorkspaceFromPicker = useCallback(async (): Promise<AgentWorkspaceEntry | null> => {
    const pickFolder = window.api?.agentWorkspace?.pickFolder
    if (!pickFolder) {
      throw new Error('agentWorkspace.pickFolder API unavailable — 请重启应用以加载最新主进程')
    }
    const folderRoot = await pickFolder()
    if (!folderRoot) return null
    return registerWorkspaceFolder(folderRoot)
  }, [registerWorkspaceFolder])

  const updateWorkspaceAvatar = useCallback(async (workspaceId: string) => {
    const avatarPath = await window.api?.agentWorkspace?.pickAvatar?.()
    if (!avatarPath) return null
    const updated = await window.api?.agentWorkspace?.updateWorkspace?.(workspaceId, { avatarPath })
    if (updated) {
      setWorkspaces((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      notifyAgentWorkspacesChanged()
    }
    return updated
  }, [])

  const activeWorkspace =
    workspaces.find((entry) => entry.id === activeWorkspaceId) ?? workspaces[0] ?? null

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id ?? null,
    loading,
    selectWorkspace,
    addWorkspaceFromPicker,
    registerWorkspaceFolder,
    updateWorkspaceAvatar,
    refresh
  }
}
