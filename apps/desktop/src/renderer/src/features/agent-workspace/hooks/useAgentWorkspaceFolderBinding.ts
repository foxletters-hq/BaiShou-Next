import { useEffect, useRef } from 'react'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import { folderRegistryKey, shouldRegisterLooseFolder } from '../utils/agent-workspace-screen.util'
import { workspaceEntryMatchesFolder } from '../utils/workspace-display.util'

export interface UseAgentWorkspaceFolderBindingParams {
  routeWorkspaceId?: string
  sessionId?: string
  folderRoot: string | null
  setFolderRoot: (path: string | null) => void
  workspaces: AgentWorkspaceEntry[]
  loadingWorkspaces: boolean
  activeWorkspaceId?: string | null
  resolvedWorkspaceId?: string
  resolvedFolderRoot?: string | null
  selectWorkspace: (workspaceId: string) => void | Promise<void>
  registerWorkspaceFolder: (folderRoot: string) => Promise<unknown>
  navigateHome: () => void
}

export function useAgentWorkspaceFolderBinding({
  routeWorkspaceId,
  sessionId,
  folderRoot,
  setFolderRoot,
  workspaces,
  loadingWorkspaces,
  activeWorkspaceId,
  resolvedWorkspaceId,
  resolvedFolderRoot,
  selectWorkspace,
  registerWorkspaceFolder,
  navigateHome
}: UseAgentWorkspaceFolderBindingParams): void {
  const syncedFolderKeysRef = useRef(new Set<string>())

  // 从 /open/:workspaceId 进入：校验并选中目录
  useEffect(() => {
    if (!routeWorkspaceId || loadingWorkspaces) return
    const target = workspaces.find((entry) => entry.id === routeWorkspaceId)
    if (!target) {
      navigateHome()
      return
    }
    if (activeWorkspaceId !== target.id) {
      void selectWorkspace(target.id)
    }
    if (folderRoot !== target.folderRoot) {
      setFolderRoot(target.folderRoot)
    }
  }, [
    activeWorkspaceId,
    folderRoot,
    loadingWorkspaces,
    navigateHome,
    routeWorkspaceId,
    selectWorkspace,
    setFolderRoot,
    workspaces
  ])

  // 从会话深链进入：按 binding 恢复目录
  useEffect(() => {
    if (!sessionId || sessionId === 'new-session' || routeWorkspaceId) return
    let cancelled = false
    void window.api?.agentWorkspace
      ?.getBinding?.(sessionId)
      .then((binding) => {
        if (cancelled || !binding?.folderRoot) return
        setFolderRoot(binding.folderRoot)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [routeWorkspaceId, sessionId, setFolderRoot])

  useEffect(() => {
    if (resolvedFolderRoot) {
      setFolderRoot(resolvedFolderRoot)
    }
  }, [resolvedFolderRoot, setFolderRoot])

  useEffect(() => {
    if (!folderRoot) return
    const key = folderRegistryKey(folderRoot)
    const alreadyInList = workspaces.some((entry) => workspaceEntryMatchesFolder(entry, folderRoot))
    if (alreadyInList) {
      syncedFolderKeysRef.current.add(key)
      return
    }
    if (
      !shouldRegisterLooseFolder({
        loadingWorkspaces,
        folderRoot,
        alreadyInList,
        alreadySynced: syncedFolderKeysRef.current.has(key)
      })
    ) {
      return
    }
    syncedFolderKeysRef.current.add(key)
    void registerWorkspaceFolder(folderRoot).catch((error) => {
      syncedFolderKeysRef.current.delete(key)
      console.error('[AgentWorkspaceScreen] sync folder to registry failed:', error)
    })
  }, [folderRoot, loadingWorkspaces, registerWorkspaceFolder, workspaces])

  useEffect(() => {
    if (!sessionId || !folderRoot || !workspaces.length) return
    const match = workspaces.find((entry) => workspaceEntryMatchesFolder(entry, folderRoot))
    if (match && match.id !== resolvedWorkspaceId) {
      void selectWorkspace(match.id)
    }
  }, [sessionId, folderRoot, workspaces, resolvedWorkspaceId, selectWorkspace])
}
