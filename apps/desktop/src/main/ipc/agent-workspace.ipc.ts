import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as path from 'path'
import * as crypto from 'crypto'
import type { AgentWorkspaceSessionListItem } from '@baishou/shared'
import { logger } from '@baishou/shared'
import {
  admitWorkspaceInput,
  cancelWorkspacePendingInput,
  createWorkspaceAgentSession,
  listWorkspacePendingInputs,
  previewWorkspaceRollback,
  removeWorkspaceSessionWithCheckpoints,
  rollbackWorkspaceRound,
  runWorkspaceStreamChat
} from '../services/agent-workspace-chat.service'
import {
  attachWorkspaceNotebook,
  getWorkspaceSessionBinding,
  listWorkspaceSessions,
  setWorkspaceSessionPinned
} from '../services/agent-workspace-session.store'
import {
  addAgentWorkspace,
  getAgentWorkspaceById,
  getLastActiveWorkspaceId,
  listAgentWorkspaces,
  pickWorkspaceAvatarImage,
  removeAgentWorkspace,
  setLastActiveWorkspaceId,
  updateAgentWorkspace
} from '../services/agent-workspace-registry.store'
import { cleanupUnusedWorkspaceShadowGit } from '../services/workspace-shadow-git.provider'
import { ensureScratchWorkspace } from '../services/agent-workspace-scratch.service'
import { getAgentManagers } from './agent-helpers'
import { registerAgentWorkspaceFilesIPC } from './agent-workspace-files.ipc'
import { registerAgentWorkspaceGitIPC } from './agent-workspace-git.ipc'

export function registerAgentWorkspaceIPC(): void {
  ipcMain.handle('agent-workspace:pick-folder', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = window
      ? await dialog.showOpenDialog(window, {
          properties: ['openDirectory']
        })
      : await dialog.showOpenDialog({
          properties: ['openDirectory']
        })

    if (result.canceled || !result.filePaths[0]) return null
    return path.resolve(result.filePaths[0])
  })

  ipcMain.handle('agent-workspace:list-workspaces', async () => {
    return listAgentWorkspaces()
  })

  ipcMain.handle('agent-workspace:ensure-scratch-workspace', async () => {
    return ensureScratchWorkspace()
  })

  ipcMain.handle('agent-workspace:add-workspace', async (_, folderRoot: string) => {
    if (!folderRoot?.trim()) return null
    return addAgentWorkspace(folderRoot)
  })

  ipcMain.handle(
    'agent-workspace:update-workspace',
    async (
      _,
      params: { workspaceId: string; patch: import('@baishou/shared').AgentWorkspaceEntryUpdate }
    ) => {
      return updateAgentWorkspace(params.workspaceId, params.patch ?? {})
    }
  )

  ipcMain.handle('agent-workspace:remove-workspace', async (_, workspaceId: string) => {
    if (!workspaceId?.trim()) return false
    const entry = await getAgentWorkspaceById(workspaceId)
    const removed = await removeAgentWorkspace(workspaceId)
    if (removed && entry?.folderRoot) {
      // 会话还在就只是从列表里移除，影子仓库要留着，否则那些会话再也回滚不了
      void cleanupUnusedWorkspaceShadowGit(entry.folderRoot).catch((error: unknown) => {
        logger.warn(
          '[AgentWorkspaceIPC] shadow git cleanup failed:',
          error instanceof Error ? error.message : String(error)
        )
      })
    }
    return removed
  })

  ipcMain.handle('agent-workspace:get-last-active-workspace-id', async () => {
    return getLastActiveWorkspaceId()
  })

  ipcMain.handle(
    'agent-workspace:set-last-active-workspace-id',
    async (_, workspaceId: string | null) => {
      await setLastActiveWorkspaceId(workspaceId)
      return true
    }
  )

  ipcMain.handle(
    'agent-workspace:get-auto-accept',
    async (_, workspaceId: string): Promise<boolean> => {
      const { getWorkspaceAutoAcceptEnabled } = await import('../services/agent-gate.service')
      return getWorkspaceAutoAcceptEnabled(workspaceId)
    }
  )

  ipcMain.handle(
    'agent-workspace:set-auto-accept',
    async (_, workspaceId: string, enabled: boolean): Promise<boolean> => {
      const { setWorkspaceAutoAcceptEnabled } = await import('../services/agent-gate.service')
      return setWorkspaceAutoAcceptEnabled(workspaceId, enabled)
    }
  )

  ipcMain.handle('agent-workspace:pick-avatar', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return pickWorkspaceAvatarImage(window)
  })

  ipcMain.handle(
    'agent-workspace:create-session',
    async (
      _,
      params: {
        id?: string
        folderRoot: string
        assistantId?: string
        title?: string
        providerId?: string
        modelId?: string
      }
    ) => {
      const sessionId = params.id || crypto.randomUUID()
      return createWorkspaceAgentSession({
        id: sessionId,
        folderRoot: params.folderRoot,
        assistantId: params.assistantId,
        title: params.title,
        providerId: params.providerId,
        modelId: params.modelId
      })
    }
  )

  ipcMain.handle('agent-workspace:get-binding', async (_, sessionId: string) => {
    return getWorkspaceSessionBinding(sessionId)
  })

  ipcMain.handle(
    'agent-workspace:attach-notebook',
    async (
      _,
      params: { sessionId: string; notebookId?: string | null; notebookIds?: string[] }
    ) => {
      if (!params?.sessionId?.trim()) throw new Error('sessionId is required')
      const { writeSessionMountedNotebookIds } =
        await import('../services/session-mounted-notebooks')
      const notebookIds =
        params.notebookIds ?? (params.notebookId == null ? [] : [params.notebookId])
      const ids = await writeSessionMountedNotebookIds(params.sessionId, notebookIds)
      await attachWorkspaceNotebook(params.sessionId, ids[0] ?? null)
      return getWorkspaceSessionBinding(params.sessionId)
    }
  )

  ipcMain.handle(
    'agent-workspace:list-sessions',
    async (): Promise<AgentWorkspaceSessionListItem[]> => {
      const bindings = await listWorkspaceSessions()
      const { realSessionRepo } = getAgentManagers()
      const items: AgentWorkspaceSessionListItem[] = []

      for (const binding of bindings) {
        let title = binding.folderDisplayName || path.basename(binding.folderRoot)
        let isPinned = Boolean(binding.isPinned)
        try {
          const session = await realSessionRepo.getSessionById?.(binding.sessionId)
          if (session && typeof (session as { title?: string }).title === 'string') {
            const sessionTitle = (session as { title?: string }).title?.trim()
            if (sessionTitle) title = sessionTitle
          }
          const row = session as { isPinned?: unknown; is_pinned?: unknown } | null
          isPinned =
            isPinned || Boolean(row?.isPinned) || row?.is_pinned === 1 || row?.is_pinned === true
        } catch {
          /* ignore missing session metadata */
        }

        items.push({
          sessionId: binding.sessionId,
          title,
          folderRoot: binding.folderRoot,
          folderDisplayName:
            binding.folderDisplayName || path.basename(binding.folderRoot.replace(/\\/g, '/')),
          updatedAt: binding.updatedAt,
          isPinned
        })
      }

      return items
    }
  )

  ipcMain.handle('agent-workspace:pin-session', async (_, sessionId: string, isPinned: boolean) => {
    if (!sessionId?.trim()) {
      return { success: false }
    }
    const ok = await setWorkspaceSessionPinned(sessionId, Boolean(isPinned))
    if (!ok) {
      return { success: false }
    }
    try {
      const { sessionManager } = getAgentManagers()
      await sessionManager.togglePin(sessionId, Boolean(isPinned))
    } catch (error) {
      logger.warn(
        '[AgentWorkspaceIPC] pin-session session table failed:',
        error instanceof Error ? error.message : String(error)
      )
    }
    return { success: true }
  })

  ipcMain.handle('agent-workspace:delete-session', async (_, sessionId: string) => {
    if (!sessionId?.trim()) {
      return { success: false }
    }
    await removeWorkspaceSessionWithCheckpoints(sessionId)
    try {
      const { sessionManager } = getAgentManagers()
      await sessionManager.deleteSessions([sessionId])
    } catch (error) {
      logger.warn(
        '[AgentWorkspaceIPC] delete-session session files failed:',
        error instanceof Error ? error : String(error)
      )
    }
    return { success: true }
  })

  ipcMain.handle(
    'agent-workspace:chat',
    async (
      event,
      params: {
        sessionId: string
        text: string
        userMessageId?: string
        providerId?: string
        modelId?: string
        reasoningEffort?: string
        searchMode?: boolean
      }
    ) => {
      try {
        await runWorkspaceStreamChat({
          event,
          sessionId: params.sessionId,
          userText: params.text,
          userMessageId: params.userMessageId,
          providerId: params.providerId,
          modelId: params.modelId,
          reasoningEffort: params.reasoningEffort,
          searchMode: params.searchMode,
          skipUserMessageRecording: Boolean(params.userMessageId)
        })
        const { sessionManager } = getAgentManagers()
        await sessionManager.flushSessionToDisk(params.sessionId)
        return true
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('[AgentWorkspaceIPC] chat failed:', message)
        event.sender.send('agent:stream-finish', { sessionId: params.sessionId, error: message })
        return false
      }
    }
  )

  ipcMain.handle(
    'agent-workspace:admit',
    async (
      event,
      params: {
        sessionId: string
        text: string
        delivery?: 'steer' | 'queue'
        userMessageId?: string
        providerId?: string
        modelId?: string
        reasoningEffort?: string
        searchMode?: boolean
        forceStart?: boolean
      }
    ) => {
      return admitWorkspaceInput({
        event,
        sessionId: params.sessionId,
        text: params.text,
        delivery: params.delivery,
        userMessageId: params.userMessageId,
        providerId: params.providerId,
        modelId: params.modelId,
        reasoningEffort: params.reasoningEffort,
        searchMode: params.searchMode,
        forceStart: params.forceStart
      })
    }
  )

  ipcMain.handle('agent-workspace:list-pending-inputs', async (_, sessionId: string) =>
    listWorkspacePendingInputs(sessionId)
  )

  ipcMain.handle('agent-workspace:cancel-pending-input', async (_, inputId: string) =>
    cancelWorkspacePendingInput(inputId)
  )

  ipcMain.handle(
    'agent-workspace:preview-rollback',
    async (_, params: { sessionId: string; userMessageId: string }) => {
      return previewWorkspaceRollback(params)
    }
  )

  ipcMain.handle(
    'agent-workspace:rollback-round',
    async (
      _,
      params: {
        sessionId: string
        userMessageId: string
        scope?: import('@baishou/shared').WorkspaceRollbackScope
      }
    ) => {
      return rollbackWorkspaceRound(params)
    }
  )

  registerAgentWorkspaceFilesIPC()
  registerAgentWorkspaceGitIPC()
}
