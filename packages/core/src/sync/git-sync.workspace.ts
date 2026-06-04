import { logger } from '@baishou/shared'
import type { GitStatus, GitStatusFile } from '@baishou/shared'
import type { SimpleGit } from 'simple-git'
import { GitSyncInitMixin } from './git-sync.init'
import { mapWorkingStatus } from './git-sync.helpers'

export abstract class GitSyncWorkspaceMixin extends GitSyncInitMixin {
  async getStatus(): Promise<GitStatus> {
    const git = await this.ensureGit()

    if (await this.untrackBaishouFiles(git)) {
      return this.getStatus()
    }

    const status = await git.status()

    const staged: GitStatusFile[] = []
    const unstaged: GitStatusFile[] = []

    for (const file of status.files) {
      if (this.isExcludedFromVersionControl(file.path)) {
        continue
      }
      if (file.index === '?' || file.working_dir === '?') {
        continue
      }
      const stagedStatus = mapWorkingStatus(file.index)
      const unstagedStatus = mapWorkingStatus(file.working_dir)

      if (stagedStatus !== '') {
        staged.push({
          path: file.path,
          stagedStatus,
          unstagedStatus: ''
        })
      }

      if (unstagedStatus !== '') {
        unstaged.push({
          path: file.path,
          stagedStatus: '',
          unstagedStatus
        })
      }
    }

    return {
      staged,
      unstaged,
      untracked: status.not_added.filter((p) => !this.isExcludedFromVersionControl(p)),
      conflicted: status.conflicted,
      hasChanges: !status.isClean()
    }
  }

  async stageFile(filePath: string): Promise<void> {
    return this._withGitLock(async () => {
      const git = await this.ensureGit()
      logger.info(`[GitSync] 暂存文件: ${filePath}`)
      await git.add(filePath)
    })
  }

  async stageAll(): Promise<void> {
    return this._withGitLock(async () => {
      const git = await this.ensureGit()
      await this.stagePendingChanges(git)
    })
  }

  async unstageFile(filePath: string): Promise<void> {
    return this._withGitLock(async () => {
      const git = await this.ensureGit()
      logger.info(`[GitSync] 取消暂存: ${filePath}`)
      await git.reset(['--', filePath])
    })
  }

  async unstageAll(): Promise<void> {
    return this._withGitLock(async () => {
      const git = await this.ensureGit()
      logger.info('[GitSync] 取消暂存全部文件')
      await git.reset()
    })
  }

  async discardFile(filePath: string): Promise<void> {
    return this._withGitLock(async () => {
      const git = await this.ensureGit()
      logger.info(`[GitSync] 丢弃修改: ${filePath}`)
      await git.checkout(['--', filePath])
    })
  }

  async discardAllChanges(): Promise<void> {
    return this._withGitLock(async () => {
      const git = await this.ensureGit()
      logger.info('[GitSync] 丢弃全部修改')

      try {
        await git.checkout(['--', '.'])
      } catch (err: any) {
        const msg = err?.message || ''
        if (msg.includes('unable to unlink') || msg.includes('Invalid argument')) {
          logger.warn('[GitSync] 整体丢弃遇到锁定文件，改为逐文件丢弃')
          await this.discardAllFileByFile(git)
        } else {
          throw err
        }
      }

      await this.cleanUntracked(git)
    })
  }

  protected async discardAllFileByFile(git: SimpleGit): Promise<void> {
    const modifiedFiles = await git.raw(['diff', '--name-only'])
    const files = modifiedFiles.split('\n').filter(Boolean)
    let failCount = 0

    for (const file of files) {
      try {
        await git.checkout(['--', file])
      } catch {
        failCount++
        logger.warn(`[GitSync] 跳过无法丢弃的锁定文件: ${file}`)
      }
    }

    logger.info(`[GitSync] 逐文件丢弃完成，跳过 ${failCount} 个锁定文件`)
  }

  protected async cleanUntracked(git: SimpleGit): Promise<void> {
    try {
      await git.clean('f', ['-d'])
      logger.info('[GitSync] 已清理未跟踪文件')
    } catch (err: any) {
      const msg = err?.message || ''
      if (msg.includes('unable to unlink') || msg.includes('Invalid argument')) {
        logger.warn('[GitSync] 清理未跟踪文件时遇到锁定文件，已跳过')
      } else {
        logger.warn(`[GitSync] 清理未跟踪文件失败: ${msg}`)
      }
    }
  }
}
