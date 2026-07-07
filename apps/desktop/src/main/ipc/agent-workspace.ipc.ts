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
import {
  addAgentWorkspace,
  getLastActiveWorkspaceId,
  listAgentWorkspaces,
  pickWorkspaceAvatarImage,
  setLastActiveWorkspaceId,
  updateAgentWorkspace
} from '../services/agent-workspace-registry.store'
import { getAgentManagers } from './agent-helpers'
import { getWorkspaceFolderGitService } from '../services/workspace-folder-git.registry'
import { replaceInWorkspaceFiles, searchWorkspaceFiles } from '@baishou/core-desktop'

function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

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

  ipcMain.handle('agent-workspace:list-workspaces', async () => {
    return listAgentWorkspaces()
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

  ipcMain.handle('agent-workspace:get-last-active-workspace-id', async () => {
    return getLastActiveWorkspaceId()
  })

  ipcMain.handle('agent-workspace:set-last-active-workspace-id', async (_, workspaceId: string | null) => {
    await setLastActiveWorkspaceId(workspaceId)
    return true
  })

  ipcMain.handle('agent-workspace:pick-avatar', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return pickWorkspaceAvatarImage(window)
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
          content: stripUtf8Bom(buffer.toString('utf-8')),
          truncated,
          byteLength: stat.size
        }
      } finally {
        await handle.close()
      }
    }
  )

  ipcMain.handle(
    'agent-workspace:write-file',
    async (_event, rootPath: string, relativePath: string, content: string) => {
      const filePath = resolveWithinRoot(rootPath, relativePath)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, content, 'utf-8')
      return true
    }
  )

  ipcMain.handle(
    'agent-workspace:create-file',
    async (_event, rootPath: string, relativePath: string, content = '') => {
      const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
      if (!normalized.trim()) throw new Error('Invalid file path')
      const filePath = resolveWithinRoot(rootPath, normalized)
      try {
        await fs.mkdir(path.dirname(filePath), { recursive: true })
        await fs.writeFile(filePath, content, { encoding: 'utf-8', flag: 'wx' })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          throw new Error('File already exists')
        }
        throw error
      }
      return { relativePath: normalized }
    }
  )

  ipcMain.handle(
    'agent-workspace:create-directory',
    async (_event, rootPath: string, relativePath: string) => {
      const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/$/, '')
      if (!normalized.trim()) throw new Error('Invalid folder path')
      const dirPath = resolveWithinRoot(rootPath, normalized)
      await fs.mkdir(dirPath, { recursive: true })
      return { relativePath: normalized }
    }
  )

  ipcMain.handle(
    'agent-workspace:delete-entry',
    async (_event, rootPath: string, relativePath: string) => {
      const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
      if (!normalized.trim()) throw new Error('Cannot delete workspace root')
      const targetPath = resolveWithinRoot(rootPath, normalized)
      await fs.rm(targetPath, { recursive: true, force: true })
      return true
    }
  )

  ipcMain.handle(
    'agent-workspace:rename-entry',
    async (_event, rootPath: string, relativePath: string, nextName: string) => {
      const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
      const trimmedName = nextName.trim().replace(/\\/g, '/').split('/').pop() ?? ''
      if (!normalized.trim() || !trimmedName) throw new Error('Invalid rename target')
      const parent = path.posix.dirname(normalized.replace(/\\/g, '/'))
      const nextRelative = parent === '.' ? trimmedName : `${parent}/${trimmedName}`
      const fromPath = resolveWithinRoot(rootPath, normalized)
      const toPath = resolveWithinRoot(rootPath, nextRelative)
      await fs.rename(fromPath, toPath)
      return { relativePath: nextRelative }
    }
  )

  ipcMain.handle(
    'agent-workspace:search-files',
    async (_event, rootPath: string, options: import('@baishou/shared').WorkspaceSearchOptions) => {
      if (!rootPath?.trim()) {
        return { files: [], totalMatches: 0, totalFiles: 0, truncated: false }
      }
      return searchWorkspaceFiles(path.resolve(rootPath), options ?? { pattern: '' })
    }
  )

  ipcMain.handle(
    'agent-workspace:replace-in-files',
    async (_event, rootPath: string, options: import('@baishou/shared').WorkspaceReplaceOptions) => {
      if (!rootPath?.trim()) {
        return { filesChanged: 0, replacements: 0, errors: ['No workspace folder'] }
      }
      return replaceInWorkspaceFiles(path.resolve(rootPath), options)
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
        event.sender.send('agent:stream-finish', { sessionId: params.sessionId, error: message })
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

  const withGit = <T>(folderRoot: string, fn: (svc: ReturnType<typeof getWorkspaceFolderGitService>) => Promise<T>) => {
    if (!folderRoot?.trim()) throw new Error('Workspace folder is required')
    return fn(getWorkspaceFolderGitService(folderRoot))
  }

  ipcMain.handle('agent-workspace:git-is-initialized', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.isInitialized())
  )

  ipcMain.handle('agent-workspace:git-init', async (_, folderRoot: string) => {
    try {
      await withGit(folderRoot, (svc) => svc.init())
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('agent-workspace:git-get-status', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.getStatus())
  )

  ipcMain.handle('agent-workspace:git-stage-file', async (_, folderRoot: string, filePath: string) => {
    try {
      await withGit(folderRoot, (svc) => svc.stageFile(filePath))
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('agent-workspace:git-stage-all', async (_, folderRoot: string) => {
    try {
      await withGit(folderRoot, (svc) => svc.stageAll())
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('agent-workspace:git-unstage-file', async (_, folderRoot: string, filePath: string) => {
    await withGit(folderRoot, (svc) => svc.unstageFile(filePath))
    return { success: true }
  })

  ipcMain.handle('agent-workspace:git-unstage-all', async (_, folderRoot: string) => {
    await withGit(folderRoot, (svc) => svc.unstageAll())
    return { success: true }
  })

  ipcMain.handle('agent-workspace:git-discard-file', async (_, folderRoot: string, filePath: string) => {
    await withGit(folderRoot, (svc) => svc.discardFile(filePath))
    return { success: true }
  })

  ipcMain.handle('agent-workspace:git-discard-all', async (_, folderRoot: string) => {
    await withGit(folderRoot, (svc) => svc.discardAllChanges())
    return { success: true }
  })

  ipcMain.handle('agent-workspace:git-commit-staged', async (_, folderRoot: string, message: string) =>
    withGit(folderRoot, (svc) => svc.commitStaged(message))
  )

  ipcMain.handle('agent-workspace:git-commit-all', async (_, folderRoot: string, message: string) =>
    withGit(folderRoot, (svc) => svc.commitAll(message))
  )

  ipcMain.handle(
    'agent-workspace:git-get-history',
    async (_, folderRoot: string, filePath?: string, limit?: number) =>
      withGit(folderRoot, (svc) => svc.getHistory(filePath, limit))
  )

  ipcMain.handle('agent-workspace:git-get-recent-pulls', async (_, folderRoot: string, limit?: number) =>
    withGit(folderRoot, (svc) => svc.getRecentPulls(limit))
  )

  ipcMain.handle('agent-workspace:git-get-commit-changes', async (_, folderRoot: string, commitHash: string) =>
    withGit(folderRoot, (svc) => svc.getCommitChanges(commitHash))
  )

  ipcMain.handle(
    'agent-workspace:git-get-file-diff',
    async (_, folderRoot: string, filePath: string, commitHash?: string) =>
      withGit(folderRoot, (svc) => svc.getFileDiff(filePath, commitHash))
  )

  ipcMain.handle(
    'agent-workspace:git-get-working-diff',
    async (_, folderRoot: string, filePath: string, staged: boolean) =>
      withGit(folderRoot, (svc) => svc.getWorkingDiff(filePath, staged))
  )

  ipcMain.handle(
    'agent-workspace:git-get-head-file-content',
    async (_, folderRoot: string, filePath: string) =>
      withGit(folderRoot, (svc) => svc.getHeadFileContent(filePath))
  )

  ipcMain.handle('agent-workspace:git-has-conflicts', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.hasConflicts())
  )

  ipcMain.handle('agent-workspace:git-get-conflicts', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.getConflicts())
  )

  ipcMain.handle(
    'agent-workspace:git-resolve-conflict',
    async (_, folderRoot: string, filePath: string, resolution: 'ours' | 'theirs') =>
      withGit(folderRoot, (svc) => svc.resolveConflict(filePath, resolution))
  )

  ipcMain.handle(
    'agent-workspace:git-rollback-file',
    async (_, folderRoot: string, filePath: string, commitHash: string) =>
      withGit(folderRoot, (svc) => svc.rollbackFile(filePath, commitHash))
  )

  ipcMain.handle('agent-workspace:git-rollback-all', async (_, folderRoot: string, commitHash: string) =>
    withGit(folderRoot, (svc) => svc.rollbackAll(commitHash))
  )

  ipcMain.handle(
    'agent-workspace:git-get-rollback-all-context',
    async (_, folderRoot: string, commitHash: string) =>
      withGit(folderRoot, (svc) => svc.getRollbackAllContext(commitHash))
  )

  ipcMain.handle('agent-workspace:git-push', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.push())
  )

  ipcMain.handle('agent-workspace:git-pull', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.pull())
  )

  ipcMain.handle('agent-workspace:git-get-branch-info', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.getBranchInfo())
  )

  ipcMain.handle('agent-workspace:git-checkout-branch', async (_, folderRoot: string, branch: string) => {
    try {
      await withGit(folderRoot, (svc) => svc.checkoutBranch(branch))
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('agent-workspace:git-create-branch', async (_, folderRoot: string, branch: string) => {
    try {
      await withGit(folderRoot, (svc) => svc.createBranch(branch))
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('agent-workspace:git-set-remote-url', async (_, folderRoot: string, url: string) => {
    try {
      await withGit(folderRoot, (svc) => svc.setRemoteUrl(url))
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('agent-workspace:git-get-config', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.getConfig())
  )

  ipcMain.handle('agent-workspace:git-save-config', async (_, folderRoot: string, partial: unknown) => {
    try {
      await withGit(folderRoot, (svc) => svc.saveConfig(partial as Partial<import('@baishou/shared').GitSyncConfig>))
      return { success: true }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle('agent-workspace:git-test-remote', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.testRemote())
  )

  ipcMain.handle('agent-workspace:git-merge-branch', async (_, folderRoot: string, branch: string) =>
    withGit(folderRoot, (svc) => svc.mergeBranch(branch))
  )

  ipcMain.handle(
    'agent-workspace:git-delete-branch',
    async (_, folderRoot: string, branch: string, force?: boolean) =>
      withGit(folderRoot, (svc) => svc.deleteBranch(branch, force))
  )

  ipcMain.handle('agent-workspace:git-publish-branch', async (_, folderRoot: string, branch?: string) =>
    withGit(folderRoot, (svc) => svc.publishBranch(branch))
  )

  ipcMain.handle('agent-workspace:git-list-stash', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.listStash())
  )

  ipcMain.handle('agent-workspace:git-stash-push', async (_, folderRoot: string, message?: string) =>
    withGit(folderRoot, (svc) => svc.stashPush(message))
  )

  ipcMain.handle('agent-workspace:git-stash-apply', async (_, folderRoot: string, index: number) =>
    withGit(folderRoot, (svc) => svc.stashApply(index))
  )

  ipcMain.handle('agent-workspace:git-stash-pop', async (_, folderRoot: string, index: number) =>
    withGit(folderRoot, (svc) => svc.stashPop(index))
  )

  ipcMain.handle('agent-workspace:git-stash-drop', async (_, folderRoot: string, index: number) =>
    withGit(folderRoot, (svc) => svc.stashDrop(index))
  )
}
