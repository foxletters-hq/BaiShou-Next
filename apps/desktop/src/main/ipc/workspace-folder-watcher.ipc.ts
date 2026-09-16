import { ipcMain, type WebContents } from 'electron'
import * as fs from 'fs'
import { logger } from '@baishou/shared'
import { listAgentWorkspaces } from '../services/agent-workspace-registry.store'
import { workspaceFolderWatcher } from '../services/workspace-folder-watcher.service'
import {
  canStartWorkspaceFolderWatch,
  workspaceFolderWatchKey
} from '../services/workspace-folder-watcher.util'

function statFolder(folderRoot: string): { exists: boolean; isDirectory: boolean } {
  try {
    const info = fs.statSync(folderRoot)
    return { exists: true, isDirectory: info.isDirectory() }
  } catch {
    return { exists: false, isDirectory: false }
  }
}

export function registerWorkspaceFolderWatcherIPC(): void {
  const senderFolders = new WeakMap<WebContents, string>()

  const releaseSender = (sender: WebContents) => {
    const current = senderFolders.get(sender)
    if (!current) return
    senderFolders.delete(sender)
    workspaceFolderWatcher.release(current)
  }

  ipcMain.handle('agent-workspace:watch-folder', async (event, folderRoot: unknown) => {
    if (typeof folderRoot !== 'string' || !folderRoot.trim()) return false
    const workspaces = await listAgentWorkspaces()
    if (
      !canStartWorkspaceFolderWatch({
        folderRoot,
        stat: statFolder(folderRoot),
        workspaces
      })
    ) {
      logger.warn(`[WorkspaceFolderWatcher] 拒绝监听未登记或非法目录: ${folderRoot}`)
      return false
    }

    const sender = event.sender
    const started = workspaceFolderWatcher.acquire(folderRoot)
    if (!started) return false

    const previous = senderFolders.get(sender)
    if (!previous) {
      sender.once('destroyed', () => {
        releaseSender(sender)
      })
    }
    senderFolders.set(sender, folderRoot)
    return true
  })

  ipcMain.handle('agent-workspace:unwatch-folder', async (event, folderRoot: unknown) => {
    if (typeof folderRoot !== 'string' || !folderRoot.trim()) return false
    const current = senderFolders.get(event.sender)
    if (current && workspaceFolderWatchKey(current) === workspaceFolderWatchKey(folderRoot)) {
      senderFolders.delete(event.sender)
    }
    workspaceFolderWatcher.release(folderRoot)
    return true
  })
}
