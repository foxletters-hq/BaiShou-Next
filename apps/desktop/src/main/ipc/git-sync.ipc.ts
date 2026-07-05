import { ipcMain } from 'electron'
import { logger } from '@baishou/shared'
import { GitSyncServiceImpl } from '@baishou/core-desktop'
import { GitPullError, GitRemoteNotConfiguredError } from '@baishou/core-desktop'
import { pathService } from './vault.ipc'
import { resyncAfterGitWorkingTreeMutation } from '../services/git-working-tree-resync.service'

let gitService: GitSyncServiceImpl | null = null

export function getGitService(): GitSyncServiceImpl {
  if (!gitService) {
    gitService = new GitSyncServiceImpl(pathService)
  }
  return gitService
}

export function registerGitSyncIPC() {
  ipcMain.handle('git:init', async () => {
    try {
      await getGitService().init()
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message || 'Git init failed' }
    }
  })

  ipcMain.handle('git:isInitialized', async () => {
    return getGitService().isInitialized()
  })

  ipcMain.handle('git:getStatus', async () => {
    return getGitService().getStatus()
  })

  ipcMain.handle('git:stageFile', async (_, filePath: string) => {
    try {
      await getGitService().stageFile(filePath)
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message || '暂存失败' }
    }
  })

  ipcMain.handle('git:stageAll', async () => {
    try {
      await getGitService().stageAll()
      return { success: true }
    } catch (e: any) {
      return { success: false, message: e?.message || '暂存失败' }
    }
  })

  ipcMain.handle('git:unstageFile', async (_, filePath: string) => {
    await getGitService().unstageFile(filePath)
    return { success: true }
  })

  ipcMain.handle('git:unstageAll', async () => {
    await getGitService().unstageAll()
    return { success: true }
  })

  ipcMain.handle('git:discardFile', async (_, filePath: string) => {
    await getGitService().discardFile(filePath)
    await resyncAfterGitWorkingTreeMutation('git:discard-file', {
      filePath,
      scope: 'targeted'
    })
    return { success: true }
  })

  ipcMain.handle('git:discardAllChanges', async () => {
    await getGitService().discardAllChanges()
    await resyncAfterGitWorkingTreeMutation('git:discard-all', { scope: 'full' })
    return { success: true }
  })

  ipcMain.handle('git:getConfig', async () => {
    return getGitService().getConfig()
  })

  ipcMain.handle('git:updateConfig', async (_, config: any) => {
    await getGitService().updateConfig(config)
    return { success: true }
  })

  ipcMain.handle('git:testRemote', async () => {
    return getGitService().testRemoteConnection()
  })

  ipcMain.handle('git:commitAll', async (_, message: string) => {
    return getGitService().commitAll(message)
  })

  ipcMain.handle('git:commitStaged', async (_, message: string) => {
    return getGitService().commitStaged(message)
  })

  ipcMain.handle('git:commit', async (_, files: string[], message: string) => {
    return getGitService().commit(files, message)
  })

  ipcMain.handle(
    'git:getHistory',
    async (_, filePath?: string, limit?: number, _offset?: number) => {
      return getGitService().getHistory(filePath, limit)
    }
  )

  ipcMain.handle('git:getRecentPulls', async (_, limit?: number) => {
    return getGitService().getRecentPulls(limit)
  })

  ipcMain.handle('git:getCommitChanges', async (_, commitHash: string) => {
    return getGitService().getCommitChanges(commitHash)
  })

  ipcMain.handle('git:getFileDiff', async (_, filePath: string, commitHash?: string) => {
    return getGitService().getFileDiff(filePath, commitHash)
  })

  ipcMain.handle('git:getWorkingDiff', async (_, filePath: string, staged: boolean) => {
    return getGitService().getWorkingDiff(filePath, staged)
  })

  ipcMain.handle('git:rollbackFile', async (_, filePath: string, commitHash: string) => {
    try {
      await getGitService().rollbackFile(filePath, commitHash)
      await resyncAfterGitWorkingTreeMutation('git:rollback-file', {
        filePath,
        scope: 'targeted'
      })
      return { success: true }
    } catch (e: any) {
      logger.error(`[GitIPC] 回滚文件失败: ${e?.message}`)
      return { success: false, message: e?.message || 'Rollback failed' }
    }
  })

  ipcMain.handle('git:rollbackAll', async (_, commitHash: string) => {
    try {
      await getGitService().rollbackAll(commitHash)
      await resyncAfterGitWorkingTreeMutation('git:rollback-all', { scope: 'full' })
      return { success: true }
    } catch (e: any) {
      logger.error(`[GitIPC] 回滚仓库失败: ${e?.message}`)
      return { success: false, message: e?.message || 'Rollback all failed' }
    }
  })

  ipcMain.handle('git:getRollbackAllContext', async (_, commitHash: string) => {
    return getGitService().getRollbackAllContext(commitHash)
  })

  ipcMain.handle('git:push', async () => {
    try {
      await getGitService().push()
      return { success: true }
    } catch (e: any) {
      if (e instanceof GitRemoteNotConfiguredError) {
        return { success: false, message: '未配置远程仓库' }
      }
      logger.error(`[GitIPC] 推送失败:`, e as any)
      return { success: false, message: e?.message || '推送失败' }
    }
  })

  ipcMain.handle('git:pull', async () => {
    try {
      await getGitService().pull()
      await resyncAfterGitWorkingTreeMutation('git:pull', { scope: 'full' })
      return { success: true }
    } catch (e: any) {
      if (e instanceof GitRemoteNotConfiguredError) {
        return { success: false, message: '未配置远程仓库' }
      }
      if (e instanceof GitPullError) {
        return { success: false, message: e.message, conflicts: e.conflicts || [] }
      }
      logger.error(`[GitIPC] 拉取失败:`, e as any)
      return { success: false, message: e?.message || '拉取失败' }
    }
  })

  ipcMain.handle('git:hasConflicts', async () => {
    return getGitService().hasConflicts()
  })

  ipcMain.handle('git:getConflicts', async () => {
    return getGitService().getConflicts()
  })

  ipcMain.handle(
    'git:resolveConflict',
    async (_, filePath: string, resolution: 'ours' | 'theirs') => {
      await getGitService().resolveConflict(filePath, resolution)
      await resyncAfterGitWorkingTreeMutation('git:resolve-conflict', {
        filePath,
        scope: 'targeted'
      })
      return { success: true }
    }
  )
}

export function resetGitService() {
  gitService = null
}
