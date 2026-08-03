import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const [workspaces, setWorkspaces] = useState<AgentWorkspaceEntry[]>([])
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null)
  const [lastActiveWorkspaceId, setLastActiveWorkspaceId] = useState<string | null>(null)
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
      setLastActiveWorkspaceId(
        typeof lastActiveId === 'string' && list.some((entry) => entry.id === lastActiveId)
          ? lastActiveId
          : null
      )
      // 不自动选中 lastActive / list[0]；仅在当前选中仍存在时保留
      setActiveWorkspaceId((prev) => {
        if (prev && list.some((entry) => entry.id === prev)) return prev
        return null
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
    setLastActiveWorkspaceId(workspaceId)
    try {
      await window.api?.agentWorkspace?.setLastActiveWorkspaceId?.(workspaceId)
    } catch {
      /* ignore */
    }
  }, [])

  const clearActiveWorkspace = useCallback(() => {
    setActiveWorkspaceId(null)
  }, [])

  const registerWorkspaceFolder = useCallback(
    async (folderRoot: string): Promise<AgentWorkspaceEntry | null> => {
      const addWorkspace = window.api?.agentWorkspace?.addWorkspace
      if (!addWorkspace) {
        throw new Error(
          t(
            'agent_workspace.add_workspace_api_unavailable',
            'agentWorkspace.addWorkspace API unavailable — 请重启应用以加载最新主进程'
          )
        )
      }
      const entry = await addWorkspace(folderRoot)
      if (!entry) {
        throw new Error('register workspace failed')
      }
      setWorkspaces((prev) => upsertWorkspaceEntry(prev, entry))
      await selectWorkspace(entry.id)
      return entry
    },
    [selectWorkspace, t]
  )

  const addWorkspaceFromPicker = useCallback(async (): Promise<AgentWorkspaceEntry | null> => {
    const pickFolder = window.api?.agentWorkspace?.pickFolder
    if (!pickFolder) {
      throw new Error(
        t(
          'agent_workspace.pick_folder_api_unavailable',
          'agentWorkspace.pickFolder API unavailable — 请重启应用以加载最新主进程'
        )
      )
    }
    const folderRoot = await pickFolder()
    if (!folderRoot) return null
    return registerWorkspaceFolder(folderRoot)
  }, [registerWorkspaceFolder, t])

  const removeWorkspace = useCallback(
    async (workspaceId: string): Promise<boolean> => {
      const remove = window.api?.agentWorkspace?.removeWorkspace
      if (!remove) {
        throw new Error(
          t(
            'agent_workspace.remove_workspace_api_unavailable',
            'agentWorkspace.removeWorkspace API unavailable — 请重启应用以加载最新主进程'
          )
        )
      }
      const removed = await remove(workspaceId)
      if (!removed) return false
      setWorkspaces((prev) => prev.filter((item) => item.id !== workspaceId))
      setActiveWorkspaceId((prev) => (prev === workspaceId ? null : prev))
      setLastActiveWorkspaceId((prev) => (prev === workspaceId ? null : prev))
      notifyAgentWorkspacesChanged()
      return true
    },
    [t]
  )

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

  const ensureScratchWorkspace = useCallback(async (): Promise<AgentWorkspaceEntry> => {
    const ensure = window.api?.agentWorkspace?.ensureScratchWorkspace
    if (!ensure) {
      throw new Error(
        t(
          'agent_workspace.ensure_scratch_api_unavailable',
          'agentWorkspace.ensureScratchWorkspace API unavailable — 请重启应用以加载最新主进程'
        )
      )
    }
    const entry = await ensure()
    setWorkspaces((prev) => upsertWorkspaceEntry(prev, entry))
    notifyAgentWorkspacesChanged()
    return entry
  }, [t])

  const activeWorkspace = workspaces.find((entry) => entry.id === activeWorkspaceId) ?? null

  return {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    lastActiveWorkspaceId,
    loading,
    selectWorkspace,
    clearActiveWorkspace,
    addWorkspaceFromPicker,
    registerWorkspaceFolder,
    removeWorkspace,
    updateWorkspaceAvatar,
    ensureScratchWorkspace,
    refresh
  }
}
