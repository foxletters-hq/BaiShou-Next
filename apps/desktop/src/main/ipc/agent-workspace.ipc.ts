import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import type { AgentWorkspaceDirEntry, AgentWorkspaceReadFileResult, AgentWorkspaceSessionListItem } from '@baishou/shared'
import { logger } from '@baishou/shared'
import {
  createWorkspaceAgentSession,
  rollbackWorkspaceRound,
  runWorkspaceStreamChat
} from '../services/agent-workspace-chat.service'
import {
  getWorkspaceSessionBinding,
  listWorkspaceSessions,
  removeWorkspaceSession
} from '../services/agent-workspace-session.store'
import { getAgentManagers } from './agent-helpers'

const MAX_READ_BYTES = 512 * 1024
const MAX_LIST_ENTRIES = 500

function resolveWithinRoot(rootPath: string, relativePath = ''): string {
  const root = path.resolve(rootPath)
  const target = path.resolve(root, relativePath || '.')
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes workspace root')
  }
  return target
}

async function listDirectoryEntries(
  rootPath: string,
  relativePath = ''
): Promise<AgentWorkspaceDirEntry[]> {
  const dirPath = resolveWithinRoot(rootPath, relativePath)
  const stat = await fs.stat(dirPath)
  if (!stat.isDirectory()) {
    throw new Error('Not a directory')
  }

  const names = await fs.readdir(dirPath)
  const entries: AgentWorkspaceDirEntry[] = []

  for (const name of names.slice(0, MAX_LIST_ENTRIES)) {
    if (name.startsWith('.')) continue
    const fullPath = path.join(dirPath, name)
    try {
      const entryStat = await fs.stat(fullPath)
      const entryRelative = relativePath ? path.posix.join(relativePath.replace(/\\/g, '/'), name) : name
      entries.push({
        name,
        relativePath: entryRelative,
        isDirectory: entryStat.isDirectory()
      })
    } catch {
      /* skip inaccessible entries */
    }
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return entries
}

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

  ipcMain.handle(
    'agent-workspace:list-dir',
    async (_event, rootPath: string, relativePath?: string): Promise<AgentWorkspaceDirEntry[]> => {
      if (!rootPath?.trim()) return []
      try {
        return await listDirectoryEntries(rootPath, relativePath)
      } catch (error) {
        logger.warn(
          '[AgentWorkspaceIPC] list-dir failed:',
          error instanceof Error ? error : String(error)
        )
        return []
      }
    }
  )

  ipcMain.handle(
    'agent-workspace:read-file',
    async (
      _event,
      rootPath: string,
      relativePath: string
    ): Promise<AgentWorkspaceReadFileResult> => {
      const filePath = resolveWithinRoot(rootPath, relativePath)
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) {
        throw new Error('Not a file')
      }

      const truncated = stat.size > MAX_READ_BYTES
      const length = truncated ? MAX_READ_BYTES : stat.size
      const handle = await fs.open(filePath, 'r')
      try {
        const buffer = Buffer.alloc(length)
        await handle.read(buffer, 0, length, 0)
        return {
          content: buffer.toString('utf-8'),
          truncated,
          byteLength: stat.size
        }
      } finally {
        await handle.close()
      }
    }
  )

  ipcMain.handle(
    'agent-workspace:create-session',
    async (
      _,
      params: { id?: string; folderRoot: string; assistantId?: string; title?: string }
    ) => {
      const sessionId = params.id || crypto.randomUUID()
      return createWorkspaceAgentSession({
        id: sessionId,
        folderRoot: params.folderRoot,
        assistantId: params.assistantId,
        title: params.title
      })
    }
  )

  ipcMain.handle('agent-workspace:get-binding', async (_, sessionId: string) => {
    return getWorkspaceSessionBinding(sessionId)
  })

  ipcMain.handle('agent-workspace:list-sessions', async (): Promise<AgentWorkspaceSessionListItem[]> => {
    const bindings = await listWorkspaceSessions()
    const { realSessionRepo } = getAgentManagers()
    const items: AgentWorkspaceSessionListItem[] = []

    for (const binding of bindings) {
      let title = binding.folderDisplayName || path.basename(binding.folderRoot)
      try {
        const session = await realSessionRepo.getSessionById?.(binding.sessionId)
        if (session && typeof (session as { title?: string }).title === 'string') {
          const sessionTitle = (session as { title?: string }).title?.trim()
          if (sessionTitle) title = sessionTitle
        }
      } catch {
        /* ignore missing session metadata */
      }

      items.push({
        sessionId: binding.sessionId,
        title,
        folderRoot: binding.folderRoot,
        folderDisplayName:
          binding.folderDisplayName ||
          path.basename(binding.folderRoot.replace(/\\/g, '/')),
        updatedAt: binding.updatedAt
      })
    }

    return items
  })

  ipcMain.handle('agent-workspace:delete-session', async (_, sessionId: string) => {
    if (!sessionId?.trim()) {
      return { success: false }
    }
    await removeWorkspaceSession(sessionId)
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
          skipUserMessageRecording: Boolean(params.userMessageId)
        })
        const { sessionManager } = getAgentManagers()
        await sessionManager.flushSessionToDisk(params.sessionId)
        return true
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('[AgentWorkspaceIPC] chat failed:', message)
        event.sender.send('agent:stream-finish', { error: message })
        return false
      }
    }
  )

  ipcMain.handle(
    'agent-workspace:rollback-round',
    async (_, params: { sessionId: string; userMessageId: string }) => {
      return rollbackWorkspaceRound(params)
    }
  )
}
