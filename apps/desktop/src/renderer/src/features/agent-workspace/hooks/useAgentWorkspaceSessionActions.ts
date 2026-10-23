import { useCallback } from 'react'
import type { AgentWorkspaceEntry } from '@baishou/shared'
import { clearStreamBridgeForSession } from '../../agent/hooks/agent-stream-session-store'
import {
  isPersistedWorkspaceSessionId,
  notifyWorkspaceSessionsChanged,
  openWorkspacePath
} from '../utils/agent-workspace-screen.util'
import { workspaceEntryMatchesFolder } from '../utils/workspace-display.util'

type Translate = (key: string, fallback: string) => string

export interface UseAgentWorkspaceSessionActionsParams {
  t: Translate
  dialog: {
    alert: (message: string, title?: string) => Promise<unknown>
    confirm: (message: string, title?: string) => Promise<boolean>
  }
  navigate: (path: string) => void
  sessionId?: string
  routeWorkspaceId?: string
  boundStreamSessionId?: string
  setBoundStreamSessionId: (id: string | undefined) => void
  setComposerRefill: (value: null) => void
  setFolderRoot: (path: string | null) => void
  resolvedWorkspaceId?: string
  workspaces: AgentWorkspaceEntry[]
  selectWorkspace: (workspaceId: string) => void | Promise<void>
  addWorkspaceFromPicker: () => Promise<AgentWorkspaceEntry | null>
  isStreaming: boolean
  stopChat: () => void
}

export function useAgentWorkspaceSessionActions({
  t,
  dialog,
  navigate,
  sessionId,
  routeWorkspaceId,
  boundStreamSessionId,
  setBoundStreamSessionId,
  setComposerRefill,
  setFolderRoot,
  resolvedWorkspaceId,
  workspaces,
  selectWorkspace,
  addWorkspaceFromPicker,
  isStreaming,
  stopChat
}: UseAgentWorkspaceSessionActionsParams) {
  const handleBackToHome = useCallback(() => {
    setFolderRoot(null)
    navigate('/agent-workspace')
  }, [navigate, setFolderRoot])

  const handleAddWorkspace = useCallback(async () => {
    try {
      const entry = await addWorkspaceFromPicker()
      if (entry) {
        setFolderRoot(entry.folderRoot)
        navigate(openWorkspacePath(entry.id))
      }
    } catch (error) {
      console.error('[AgentWorkspaceScreen] add workspace failed:', error)
      await dialog.alert(
        error instanceof Error
          ? error.message
          : t('agent_workspace.add_workspace_failed', '添加工作区失败，请重启应用后重试'),
        t('agent_workspace.add_workspace', '添加工作区')
      )
    }
  }, [addWorkspaceFromPicker, dialog, navigate, setFolderRoot, t])

  const handleNewSession = useCallback(() => {
    const id = resolvedWorkspaceId ?? routeWorkspaceId
    if (!id) return
    if (isStreaming) {
      stopChat()
    }
    const previousBind = isPersistedWorkspaceSessionId(sessionId) ? sessionId : boundStreamSessionId
    if (previousBind) {
      clearStreamBridgeForSession(previousBind)
    }
    setBoundStreamSessionId(undefined)
    setComposerRefill(null)
    navigate(openWorkspacePath(id))
  }, [
    boundStreamSessionId,
    isStreaming,
    navigate,
    resolvedWorkspaceId,
    routeWorkspaceId,
    sessionId,
    setBoundStreamSessionId,
    setComposerRefill,
    stopChat
  ])

  const handleSelectSession = useCallback(
    async (targetSessionId: string) => {
      if (targetSessionId === sessionId) return
      try {
        const binding = await window.api.agentWorkspace.getBinding(targetSessionId)
        if (binding?.folderRoot) {
          setFolderRoot(binding.folderRoot)
          const workspace = workspaces.find((entry) =>
            workspaceEntryMatchesFolder(entry, binding.folderRoot)
          )
          if (workspace) {
            await selectWorkspace(workspace.id)
          }
        }
      } catch {
        /* ignore */
      }
      navigate(`/agent-workspace/${targetSessionId}`)
    },
    [navigate, sessionId, selectWorkspace, setFolderRoot, workspaces]
  )

  const handleDeleteSession = useCallback(
    async (targetSessionId: string) => {
      const confirmed = await dialog.confirm(
        t(
          'agent_workspace.delete_session_confirm',
          '确定删除此工作区会话？相关对话记录也会被移除。'
        ),
        t('agent_workspace.delete_session', '删除会话')
      )
      if (!confirmed) return

      try {
        await window.api.agentWorkspace.deleteSession(targetSessionId)
        notifyWorkspaceSessionsChanged()
        if (targetSessionId === sessionId) {
          navigate(
            resolvedWorkspaceId ? openWorkspacePath(resolvedWorkspaceId) : '/agent-workspace'
          )
        }
      } catch (error) {
        console.error('[AgentWorkspaceScreen] delete session failed:', error)
        await dialog.alert(
          t('common.error', '操作失败'),
          t('agent_workspace.delete_session', '删除会话')
        )
      }
    },
    [dialog, navigate, resolvedWorkspaceId, sessionId, t]
  )

  const handleRenameSession = useCallback(
    async (targetSessionId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return

      try {
        await window.electron.ipcRenderer.invoke(
          'agent:update-session-title',
          targetSessionId,
          trimmed
        )
        notifyWorkspaceSessionsChanged()
      } catch (error) {
        console.error('[AgentWorkspaceScreen] rename session failed:', error)
        await dialog.alert(t('common.error', '操作失败'), t('workbench.rename_session', '重命名'))
      }
    },
    [dialog, t]
  )

  return {
    handleBackToHome,
    handleAddWorkspace,
    handleNewSession,
    handleSelectSession,
    handleDeleteSession,
    handleRenameSession
  }
}
